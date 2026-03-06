/**
 * board.js - Kanban board view with drag-and-drop column management.
 * renderBoard(container, projectId) - fetches data and builds the board.
 */

import { api } from '../api.js';
import { getState, setState } from '../state.js';
import { renderHeader } from '../components/header.js';
import { createIssueCard } from '../components/issue_card.js';
import { showIssueModal } from '../components/issue_modal.js';
import { showToast } from '../components/toast.js';

// ── Column definitions ─────────────────────────────────────
const COLUMNS = [
  { key: 'Backlog',    label: 'Backlog',     categories: ['backlog'] },
  { key: 'Todo',       label: 'To Do',       categories: ['todo'] },
  { key: 'InProgress', label: 'In Progress', categories: ['inprogress', 'in progress', 'active'] },
  { key: 'Done',       label: 'Done',        categories: ['done', 'won', 'completed'] },
];

const SKIP_CATEGORIES = new Set(['cancelled', 'canceled']);

/**
 * Normalises a status category string for comparison.
 */
function normalizeCategory(cat = '') {
  // Handle Huly-style refs like "tracker:issueStatusCategory:Active"
  const parts = cat.split(':');
  const last = parts[parts.length - 1];
  return last.toLowerCase().replace(/\s+/g, '');
}

/**
 * Maps a status category to one of the four column keys.
 * Returns null for skipped categories.
 * @param {string} category
 * @returns {string|null}
 */
function categoryToColumnKey(category) {
  const norm = normalizeCategory(category);
  if (SKIP_CATEGORIES.has(norm)) return null;
  for (const col of COLUMNS) {
    if (col.categories.includes(norm)) return col.key;
  }
  // Default unmapped active categories to InProgress.
  return 'InProgress';
}

/**
 * Groups issues by column key.
 * @param {object[]} issues
 * @param {object[]} statuses
 * @returns {Map<string, object[]>}
 */
function groupIssues(issues, statuses) {
  // Build a lookup: statusId → columnKey
  const statusMap = new Map();
  statuses.forEach((s) => {
    const key = categoryToColumnKey(s.category);
    statusMap.set(s.id, key);
  });

  const groups = new Map(COLUMNS.map((c) => [c.key, []]));

  issues.forEach((issue) => {
    const colKey = statusMap.get(issue.status) ?? categoryToColumnKey(issue.statusCategory);
    if (colKey === null) return; // skip cancelled
    const bucket = groups.get(colKey);
    if (bucket) bucket.push(issue);
  });

  return groups;
}

/**
 * Picks the best status ID from the statuses list for a target column key.
 */
function pickStatusForColumn(colKey, statuses) {
  const col = COLUMNS.find((c) => c.key === colKey);
  if (!col) return null;
  const match = statuses.find((s) => col.categories.includes(normalizeCategory(s.category)));
  return match?.id ?? null;
}

// ── Board module-level state ───────────────────────────────
let boardState = {
  projectId: null,
  issues:    [],
  members:   [],
  statuses:  [],
  project:   null,
  filterMine: false,
  activeTab:  'Backlog',
};

/**
 * Main board renderer.
 * @param {HTMLElement} container
 * @param {string} projectId
 */
export async function renderBoard(container, projectId) {
  boardState.projectId = projectId;

  // ── Loading ────────────────────────────────────────────────
  const loading = document.createElement('div');
  loading.className = 'loading-spinner';
  loading.innerHTML = '<div class="spinner"></div>';
  container.appendChild(loading);

  // ── Fetch all required data in parallel ────────────────────
  let issues, members, statuses;
  try {
    [issues, members, statuses] = await Promise.all([
      api.issues(projectId),
      api.members(),
      api.statuses(),
    ]);
  } catch (err) {
    loading.remove();
    const errEl = document.createElement('p');
    errEl.style.padding = '2rem';
    errEl.textContent = `Failed to load board: ${err.message}`;
    container.appendChild(errEl);
    showToast(err.message, 'error');
    return;
  }

  loading.remove();

  boardState.issues   = issues  ?? [];
  boardState.members  = members ?? [];
  boardState.statuses = statuses ?? [];

  // Resolve project name from cached state.
  const appState = getState();
  boardState.project = appState.projects.find((p) => p.id === projectId)
    ?? appState.currentProject
    ?? { name: projectId };

  setState({ issues: boardState.issues, members: boardState.members, statuses: boardState.statuses });

  // Swap the generic header for one with breadcrumb.
  const existingHeader = container.querySelector('.app-header');
  if (existingHeader) existingHeader.remove();
  container.insertBefore(renderHeader(boardState.project.name), container.firstChild);

  renderBoardUI(container, projectId);
}

/**
 * (Re-)renders the board UI inside the container, after the header.
 * Safe to call after create/update/delete to refresh the view.
 */
function renderBoardUI(container, projectId) {
  // Remove any existing board page.
  container.querySelector('.board-page')?.remove();

  const appState = getState();
  const currentUser = appState.user;

  const filteredIssues = boardState.filterMine && currentUser
    ? boardState.issues.filter((i) => i.assigneeId === currentUser.id ||
        boardState.members.find((m) => m.email === currentUser.email && m.id === i.assigneeId))
    : boardState.issues;

  const groups = groupIssues(filteredIssues, boardState.statuses);

  // ── Build page shell ───────────────────────────────────────
  const page = document.createElement('div');
  page.className = 'board-page';

  // ── Filter bar ─────────────────────────────────────────────
  const filterBar = document.createElement('div');
  filterBar.className = 'filter-bar';
  filterBar.innerHTML = `
    <button class="outline secondary" id="btn-filter-mine">${boardState.filterMine ? 'All Issues' : 'My Issues'}</button>
    <span class="spacer"></span>
    <a href="#projects" class="outline secondary" role="button" style="font-size:0.8rem;padding:0.4rem 0.9rem;text-decoration:none">&#8592; Projects</a>
    <button id="btn-new-issue">+ New Issue</button>
  `;
  page.appendChild(filterBar);

  // ── Mobile tabs ────────────────────────────────────────────
  const tabsEl = document.createElement('div');
  tabsEl.className = 'board-tabs';

  COLUMNS.forEach((col) => {
    const tab = document.createElement('div');
    tab.className = `board-tab${col.key === boardState.activeTab ? ' active' : ''}`;
    tab.dataset.tab = col.key;
    tab.textContent = `${col.label} (${groups.get(col.key)?.length ?? 0})`;
    tabsEl.appendChild(tab);
  });

  page.appendChild(tabsEl);

  // ── Board columns ──────────────────────────────────────────
  const board = document.createElement('div');
  board.className = 'board';

  const sortableInstances = [];

  COLUMNS.forEach((col) => {
    const colIssues = groups.get(col.key) ?? [];
    const isActive  = col.key === boardState.activeTab;

    const colEl = document.createElement('div');
    colEl.className = `column${isActive ? ' tab-active' : ''}`;
    colEl.dataset.colKey = col.key;

    colEl.innerHTML = `
      <div class="column-header">
        <span class="col-name">${col.label}</span>
        <span class="count-badge">${colIssues.length}</span>
      </div>
      <div class="column-body"></div>
    `;

    const body = colEl.querySelector('.column-body');

    colIssues.forEach((issue) => {
      body.appendChild(createIssueCard(issue, (clickedIssue) => openEditModal(clickedIssue, container, projectId)));
    });

    board.appendChild(colEl);

    // ── SortableJS ─────────────────────────────────────────
    const sortable = Sortable.create(body, {
      group:     'issues',
      animation: 150,
      ghostClass:  'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass:   'sortable-drag',

      // Mark card as dragging to suppress click.
      onStart: (evt) => { evt.item.dataset.dragging = 'true'; },
      onEnd:   (evt) => {
        // Clear drag flag after a tick so the click handler can check it.
        setTimeout(() => { delete evt.item.dataset.dragging; }, 0);

        const card       = evt.item;
        const issueId    = card.dataset.issueId;
        const targetColEl = evt.to.closest('.column');
        const targetKey  = targetColEl?.dataset.colKey;

        if (!targetKey || targetKey === col.key && evt.oldIndex === evt.newIndex) return;

        const statusId = pickStatusForColumn(targetKey, boardState.statuses);
        if (!statusId) {
          showToast('Cannot determine target status', 'error');
          return;
        }

        // Optimistic update in local state.
        const issueIdx = boardState.issues.findIndex((i) => i.id === issueId);
        const prevStatus = issueIdx >= 0 ? boardState.issues[issueIdx].status : null;
        const prevCategory = issueIdx >= 0 ? boardState.issues[issueIdx].statusCategory : null;

        if (issueIdx >= 0) {
          boardState.issues[issueIdx].status = statusId;
          const targetStatus = boardState.statuses.find((s) => s.id === statusId);
          if (targetStatus) boardState.issues[issueIdx].statusCategory = targetStatus.category;
        }

        api.updateIssue(issueId, { status: statusId }).catch((err) => {
          showToast(`Failed to move issue: ${err.message}`, 'error');
          // Revert optimistic update and re-render.
          if (issueIdx >= 0) {
            boardState.issues[issueIdx].status = prevStatus;
            boardState.issues[issueIdx].statusCategory = prevCategory;
          }
          renderBoardUI(container, projectId);
        });
      },
    });

    sortableInstances.push(sortable);
  });

  page.appendChild(board);
  container.appendChild(page);

  // ── Tab switching (mobile) ─────────────────────────────────
  tabsEl.addEventListener('click', (e) => {
    const tab = e.target.closest('.board-tab');
    if (!tab) return;
    const key = tab.dataset.tab;
    boardState.activeTab = key;

    tabsEl.querySelectorAll('.board-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    board.querySelectorAll('.column').forEach((c) => {
      c.classList.toggle('tab-active', c.dataset.colKey === key);
    });
  });

  // ── Filter toggle ──────────────────────────────────────────
  filterBar.querySelector('#btn-filter-mine').addEventListener('click', () => {
    boardState.filterMine = !boardState.filterMine;
    renderBoardUI(container, projectId);
  });

  // ── New issue ──────────────────────────────────────────────
  filterBar.querySelector('#btn-new-issue').addEventListener('click', () => {
    showIssueModal(null, {
      members:   boardState.members,
      statuses:  boardState.statuses,
      projectId,
      onSave: async (data) => {
        try {
          const newIssue = await api.createIssue(data);
          if (newIssue) {
            boardState.issues.push(newIssue);
            setState({ issues: boardState.issues });
          }
          showToast('Issue created', 'success');
          renderBoardUI(container, projectId);
        } catch (err) {
          showToast(`Failed to create issue: ${err.message}`, 'error');
        }
      },
    });
  });
}

/**
 * Opens the edit modal for an existing issue.
 */
function openEditModal(issue, container, projectId) {
  showIssueModal(issue, {
    members:   boardState.members,
    statuses:  boardState.statuses,
    projectId,
    onSave: async (data) => {
      try {
        await api.updateIssue(issue.id, data);
        const idx = boardState.issues.findIndex((i) => i.id === issue.id);
        if (idx >= 0) Object.assign(boardState.issues[idx], data);
        setState({ issues: boardState.issues });
        showToast('Issue updated', 'success');
        renderBoardUI(container, projectId);
      } catch (err) {
        showToast(`Failed to update issue: ${err.message}`, 'error');
      }
    },
    onDelete: async (deletedIssue) => {
      try {
        await api.deleteIssue(deletedIssue.id);
        boardState.issues = boardState.issues.filter((i) => i.id !== deletedIssue.id);
        setState({ issues: boardState.issues });
        showToast('Issue deleted', 'success');
        renderBoardUI(container, projectId);
      } catch (err) {
        showToast(`Failed to delete issue: ${err.message}`, 'error');
      }
    },
  });
}
