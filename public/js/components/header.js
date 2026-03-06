/**
 * header.js - Sticky navigation header component.
 * renderHeader(projectName?) → returns a header DOM element.
 */

import { api } from '../api.js';
import { getState, setState } from '../state.js';

/**
 * @param {string} [projectName] - When present, shows a breadcrumb for the board view.
 */
export function renderHeader(projectName) {
  const header = document.createElement('header');
  header.className = 'app-header';

  const state = getState();
  const user = state.user;

  const breadcrumb = projectName
    ? `<nav class="breadcrumb">
         <a href="#projects" class="crumb">Projects</a>
         <span class="sep">/</span>
         <span class="crumb active">${escapeHtml(projectName)}</span>
       </nav>`
    : `<nav class="breadcrumb">
         <span class="crumb active">Projects</span>
       </nav>`;

  header.innerHTML = `
    <a href="#projects" class="logo">Task Portal</a>
    ${breadcrumb}
    <div class="header-right">
      ${user ? `<span class="user-name">${escapeHtml(user.name || user.email)}</span>` : ''}
      <button class="secondary outline" id="btn-logout">Logout</button>
    </div>
  `;

  header.querySelector('#btn-logout').addEventListener('click', async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors — clear state regardless.
    }
    setState({ user: null, projects: [], issues: [], members: [], statuses: [], currentProject: null });
    window.location.hash = '#login';
  });

  return header;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
