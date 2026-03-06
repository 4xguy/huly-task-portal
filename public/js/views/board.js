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
  { key: 'Backlog',    label: 'Backlog',     categories: ['backlog', 'unstarted'] },
  { key: 'Todo',       label: 'To Do',       categories: ['todo'] },
  { key: 'InProgress', label: 'In Progress', categories: ['inprogress', 'in progress', 'active'] },
  { key: 'Done',       label: 'Done',        categories: ['done', 'won', 'completed'] },
];

const SKIP_CATEGORIES = new Set(['cancelled', 'canceled', 'lost']);

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
  viewMode:   'board',  // 'board' | 'list'
  sortCol:    'identifier',
  sortAsc:    true,
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
    <div class="view-toggle">
      <button class="outline secondary${boardState.viewMode === 'board' ? ' active' : ''}" data-view="board" title="Board view">Board</button>
      <button class="outline secondary${boardState.viewMode === 'list' ? ' active' : ''}" data-view="list" title="List view">List</button>
    </div>
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

  // ── List view ────────────────────────────────────────────────
  const listWrap = document.createElement('div');
  listWrap.className = 'list-view';
  listWrap.appendChild(buildListTable(filteredIssues, container, projectId));
  page.appendChild(listWrap);

  // Show the active view
  if (boardState.viewMode === 'list') {
    board.style.display = 'none';
    tabsEl.style.display = 'none';
    listWrap.style.display = '';
  } else {
    listWrap.style.display = 'none';
  }

  page.appendChild(board);
  container.appendChild(page);

  // ── View toggle ─────────────────────────────────────────────
  filterBar.querySelector('.view-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if (!btn) return;
    boardState.viewMode = btn.dataset.view;
    renderBoardUI(container, projectId);
  });

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
          await api.createIssue(data);
          showToast('Issue created', 'success');
          await refetchAndRender(container, projectId);
        } catch (err) {
          showToast(`Failed to create issue: ${err.message}`, 'error');
        }
      },
    });
  });
}

/**
 * Refetches issues from the server and re-renders the board.
 */
async function refetchAndRender(container, projectId) {
  try {
    const issues = await api.issues(projectId);
    boardState.issues = issues ?? [];
    setState({ issues: boardState.issues });
  } catch (err) {
    console.error('[portal] refetch failed:', err);
  }
  renderBoardUI(container, projectId);
}

// ── List view helpers ─────────────────────────────────────────

const PRIORITY_LABELS = { 0: 'None', 1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'Low' };
const PRIORITY_SORT = { 1: 0, 2: 1, 3: 2, 4: 3, 0: 4 }; // urgent first

function getStatusName(statusId) {
  const s = boardState.statuses.find((st) => st.id === statusId);
  return s?.name ?? '';
}

function sortIssues(issues, col, asc) {
  const dir = asc ? 1 : -1;
  return [...issues].sort((a, b) => {
    let va, vb;
    switch (col) {
      case 'identifier': va = a.number ?? 0; vb = b.number ?? 0; break;
      case 'title':      va = (a.title || '').toLowerCase(); vb = (b.title || '').toLowerCase(); break;
      case 'status':     va = getStatusName(a.status).toLowerCase(); vb = getStatusName(b.status).toLowerCase(); break;
      case 'priority':   va = PRIORITY_SORT[a.priority] ?? 9; vb = PRIORITY_SORT[b.priority] ?? 9; break;
      case 'assignee':   va = (a.assigneeName || '').toLowerCase(); vb = (b.assigneeName || '').toLowerCase(); break;
      case 'dueDate':    va = a.dueDate || ''; vb = b.dueDate || ''; break;
      default:           return 0;
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

function buildListTable(issues, container, projectId) {
  const sorted = sortIssues(issues, boardState.sortCol, boardState.sortAsc);

  const table = document.createElement('table');
  table.className = 'issue-list-table';
  table.setAttribute('role', 'grid');

  const cols = [
    { key: 'identifier', label: 'ID' },
    { key: 'title',      label: 'Title' },
    { key: 'status',     label: 'Status' },
    { key: 'priority',   label: 'Priority' },
    { key: 'assignee',   label: 'Assignee' },
    { key: 'dueDate',    label: 'Due Date' },
  ];

  const arrow = (key) =>
    boardState.sortCol === key ? (boardState.sortAsc ? ' \u25B2' : ' \u25BC') : '';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${cols.map((c) =>
    `<th data-sort="${c.key}" class="sortable-header">${c.label}${arrow(c.key)}</th>`
  ).join('')}</tr>`;
  table.appendChild(thead);

  thead.addEventListener('click', (e) => {
    const th = e.target.closest('th[data-sort]');
    if (!th) return;
    const key = th.dataset.sort;
    if (boardState.sortCol === key) {
      boardState.sortAsc = !boardState.sortAsc;
    } else {
      boardState.sortCol = key;
      boardState.sortAsc = true;
    }
    renderBoardUI(container, projectId);
  });

  const tbody = document.createElement('tbody');

  const priorityDot = (p) => {
    const colors = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#3b82f6', 0: '#9ca3af' };
    return `<span class="priority-dot" style="background:${colors[p] || '#9ca3af'}"></span> ${PRIORITY_LABELS[p] || 'None'}`;
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const overdue = d < new Date();
    const str = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return overdue ? `<span class="overdue">${str}</span>` : str;
  };

  sorted.forEach((issue) => {
    const tr = document.createElement('tr');
    tr.className = 'issue-list-row';
    tr.innerHTML = `
      <td class="cell-id">${escapeForList(issue.identifier || '')}</td>
      <td class="cell-title">${escapeForList(issue.title)}</td>
      <td class="cell-status"><span class="status-pill">${escapeForList(getStatusName(issue.status))}</span></td>
      <td class="cell-priority">${priorityDot(issue.priority)}</td>
      <td class="cell-assignee">${escapeForList(issue.assigneeName || '\u2014')}</td>
      <td class="cell-due">${fmtDate(issue.dueDate)}</td>
    `;
    tr.addEventListener('click', () => openEditModal(issue, container, projectId));
    tbody.appendChild(tr);
  });

  if (sorted.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="${cols.length}" style="text-align:center;padding:2rem;color:var(--pico-muted-color)">No issues found</td>`;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  return table;
}

function escapeForList(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
        showToast('Issue updated', 'success');
        await refetchAndRender(container, projectId);
      } catch (err) {
        showToast(`Failed to update issue: ${err.message}`, 'error');
      }
    },
    onDelete: async (deletedIssue) => {
      try {
        await api.deleteIssue(deletedIssue.id);
        showToast('Issue deleted', 'success');
        await refetchAndRender(container, projectId);
      } catch (err) {
        showToast(`Failed to delete issue: ${err.message}`, 'error');
      }
    },
  });
}
