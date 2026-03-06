/**
 * issue_modal.js - Create / edit issue modal.
 *
 * showIssueModal(issue, { members, statuses, projectId, onSave, onDelete })
 *   issue === null  → create mode
 *   issue !== null  → edit mode
 */

import { escapeHtml } from './issue_card.js';

const PRIORITY_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
];

function buildStatusOptions(statuses, currentStatusId) {
  return statuses
    .map((s) => `<option value="${escapeHtml(s.id)}"${s.id === currentStatusId ? ' selected' : ''}>${escapeHtml(s.name)}</option>`)
    .join('');
}

function buildPriorityOptions(current) {
  return PRIORITY_OPTIONS
    .map((p) => `<option value="${p.value}"${p.value === current ? ' selected' : ''}>${p.label}</option>`)
    .join('');
}

function buildMemberOptions(members, currentId) {
  const unselected = !currentId ? ' selected' : '';
  const opts = [`<option value=""${unselected}>Unassigned</option>`];
  members.forEach((m) => {
    opts.push(`<option value="${escapeHtml(m.id)}"${m.id === currentId ? ' selected' : ''}>${escapeHtml(m.name)}</option>`);
  });
  return opts.join('');
}

function formatDateInput(iso) {
  if (!iso) return '';
  // Input[type=date] requires YYYY-MM-DD.
  return iso.split('T')[0];
}

/**
 * @param {object|null} issue
 * @param {{members: object[], statuses: object[], projectId: string, onSave: function, onDelete: function}} opts
 */
export function showIssueModal(issue, { members = [], statuses = [], projectId, onSave, onDelete } = {}) {
  const isEdit = issue !== null && issue !== undefined;
  const title = isEdit ? 'Edit Issue' : 'New Issue';

  // ── Build overlay ──────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const defaultStatusId = isEdit ? issue.status : (statuses[0]?.id ?? '');
  const defaultPriority = isEdit ? (issue.priority ?? 0) : 0;

  overlay.innerHTML = `
    <div class="modal">
      <h3>${escapeHtml(title)}</h3>
      <form id="issue-form" novalidate>
        <label>
          Title *
          <input type="text" name="title" required placeholder="Issue title"
            value="${escapeHtml(isEdit ? issue.title : '')}">
        </label>

        <label>
          Status
          <select name="status">
            ${buildStatusOptions(statuses, defaultStatusId)}
          </select>
        </label>

        <label>
          Priority
          <select name="priority">
            ${buildPriorityOptions(defaultPriority)}
          </select>
        </label>

        <label>
          Assignee
          <select name="assignee">
            ${buildMemberOptions(members, isEdit ? issue.assigneeId : '')}
          </select>
        </label>

        <label>
          Due Date
          <input type="date" name="dueDate" value="${formatDateInput(isEdit ? issue.dueDate : '')}">
        </label>

        <div class="modal-footer">
          ${isEdit ? `<button type="button" class="btn-delete contrast outline" id="btn-delete">Delete</button>` : ''}
          <button type="button" class="secondary outline" id="btn-cancel">Cancel</button>
          <button type="submit">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  // Focus the title field for accessibility.
  const titleInput = overlay.querySelector('input[name="title"]');
  requestAnimationFrame(() => titleInput?.focus());

  // ── Close helpers ──────────────────────────────────────────
  function close() {
    overlay.remove();
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', function onKeyDown(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKeyDown); }
  });

  overlay.querySelector('#btn-cancel')?.addEventListener('click', close);

  // ── Delete ─────────────────────────────────────────────────
  overlay.querySelector('#btn-delete')?.addEventListener('click', () => {
    if (!confirm('Delete this issue? This cannot be undone.')) return;
    close();
    if (typeof onDelete === 'function') onDelete(issue);
  });

  // ── Submit ─────────────────────────────────────────────────
  overlay.querySelector('#issue-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const titleVal = form.title.value.trim();
    if (!titleVal) {
      titleInput.focus();
      titleInput.setCustomValidity('Title is required.');
      titleInput.reportValidity();
      return;
    }
    titleInput.setCustomValidity('');

    const data = {
      title:    titleVal,
      status:   form.status.value || undefined,
      priority: Number(form.priority.value),
      assignee: form.assignee.value || undefined,
      dueDate:  form.dueDate.value || undefined,
    };

    if (!isEdit) {
      data.projectId = projectId;
    }

    close();
    if (typeof onSave === 'function') onSave(data);
  });
}
