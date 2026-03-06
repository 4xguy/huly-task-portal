/**
 * issue_card.js - Builds a draggable Kanban card DOM element for an issue.
 */

const PRIORITY_COLORS = {
  1: '#ef4444', // Urgent
  2: '#f97316', // High
  3: '#eab308', // Medium
  4: '#3b82f6', // Low
  0: '#9ca3af', // None
};

// Deterministic background colour from a display name string.
const AVATAR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
];

export function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats an ISO date string as a short human-readable date.
 * Returns empty string for falsy input.
 */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isDueOverdue(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  return !isNaN(d) && d < new Date();
}

/**
 * Creates a card DOM element for use in the Kanban board.
 * @param {object} issue - Issue object from the API.
 * @param {function} onClick - Called when the card body is clicked.
 */
export function createIssueCard(issue, onClick) {
  const card = document.createElement('div');
  card.className = 'issue-card';
  card.dataset.issueId = issue.id;
  card.dataset.projectId = issue.projectId;
  card.style.borderLeftColor = PRIORITY_COLORS[issue.priority] ?? '#9ca3af';

  const overdue = isDueOverdue(issue.dueDate);

  const avatarHtml = issue.assigneeName
    ? `<span class="avatar-circle"
         title="${escapeHtml(issue.assigneeName)}"
         style="background:${getAvatarColor(issue.assigneeName)}"
       >${getInitials(issue.assigneeName)}</span>`
    : '';

  const dueHtml = issue.dueDate
    ? `<span class="card-due${overdue ? ' overdue' : ''}"
         title="${escapeHtml(issue.dueDate)}"
       >${formatDate(issue.dueDate)}</span>`
    : '';

  card.innerHTML = `
    <div class="card-identifier">${escapeHtml(issue.identifier ?? '')}</div>
    <div class="card-title">${escapeHtml(issue.title)}</div>
    <div class="card-meta">
      ${avatarHtml}
      ${dueHtml}
    </div>
  `;

  if (typeof onClick === 'function') {
    card.addEventListener('click', (e) => {
      // Ignore if user was dragging (SortableJS sets this flag).
      if (card.dataset.dragging === 'true') return;
      onClick(issue);
    });
  }

  return card;
}
