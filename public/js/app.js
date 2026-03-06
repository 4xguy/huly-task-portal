/**
 * app.js - SPA entry point and hash-based router.
 * State is in state.js to avoid circular imports.
 */

import { api } from './api.js';
import { getState, setState } from './state.js';
import { renderLogin } from './views/login.js';
import { renderProjects } from './views/projects.js';
import { renderBoard } from './views/board.js';
import { renderHeader } from './components/header.js';

// Re-export for consumers that still import from app.js (backwards compat).
export { getState, setState } from './state.js';

// ── Router ─────────────────────────────────────────────────
async function router() {
  const app   = document.getElementById('app');
  const hash  = window.location.hash || '#login';
  const state = getState();

  // Attempt to restore an existing server session on first navigation.
  if (!state.user) {
    try {
      const user = await api.me();
      setState({ user });
    } catch {
      // No active session — user will be redirected to login below.
    }
  }

  const currentState = getState();

  // Unauthenticated: always redirect to login.
  if (!currentState.user && hash !== '#login') {
    window.location.hash = '#login';
    return;
  }

  // Authenticated + on login page: go straight to projects.
  if (currentState.user && hash === '#login') {
    window.location.hash = '#projects';
    return;
  }

  // ── Render the matching route ─────────────────────────────
  app.innerHTML = '';

  if (hash === '#login') {
    renderLogin(app);
    return;
  }

  if (hash === '#projects') {
    app.appendChild(renderHeader());
    await renderProjects(app);
    return;
  }

  if (hash.startsWith('#board/')) {
    const projectId = hash.split('/')[1];
    if (!projectId) {
      window.location.hash = '#projects';
      return;
    }
    // renderBoard inserts its own breadcrumb header.
    await renderBoard(app, projectId);
    return;
  }

  // Unknown route → fall back to projects.
  window.location.hash = '#projects';
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);
