/**
 * projects.js - Project selection grid.
 * renderProjects(container) - appends the projects view into container.
 */

import { api } from '../api.js';
import { setState } from '../state.js';
import { showToast } from '../components/toast.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderProjects(container) {
  const page = document.createElement('main');
  page.className = 'projects-page';

  // ── Loading state ──────────────────────────────────────────
  page.innerHTML = `
    <h2>Projects</h2>
    <div class="loading-spinner"><div class="spinner"></div></div>
  `;
  container.appendChild(page);

  let projects;
  try {
    projects = await api.projects();
    setState({ projects: projects ?? [] });
  } catch (err) {
    page.innerHTML = `
      <h2>Projects</h2>
      <p>Failed to load projects: ${escapeHtml(err.message)}</p>
      <button onclick="window.location.reload()">Retry</button>
    `;
    showToast(err.message, 'error');
    return;
  }

  if (!projects || projects.length === 0) {
    page.innerHTML = `
      <h2>Projects</h2>
      <p>No projects found. Ask your administrator to add you to a project.</p>
    `;
    return;
  }

  // ── Render grid ────────────────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'project-grid';

  projects.forEach((project) => {
    const card = document.createElement('a');
    card.className = 'project-card';
    card.href = `#board/${project.id}`;
    card.setAttribute('role', 'button');
    card.innerHTML = `
      <div class="project-name">${escapeHtml(project.name)}</div>
      <div class="project-identifier">${escapeHtml(project.identifier)}</div>
      <div class="project-members">${project.memberCount ?? 0} member${project.memberCount === 1 ? '' : 's'}</div>
    `;

    card.addEventListener('click', (e) => {
      e.preventDefault();
      setState({ currentProject: project });
      window.location.hash = `#board/${project.id}`;
    });

    grid.appendChild(card);
  });

  page.innerHTML = '<h2>Projects</h2>';
  page.appendChild(grid);
}
