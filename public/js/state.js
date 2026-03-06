/**
 * state.js - Shared application state store.
 * Extracted into its own module to avoid circular imports between
 * app.js (router) and components that need to read/write state.
 */

const state = {
  user:           null,
  projects:       [],
  issues:         [],
  members:        [],
  statuses:       [],
  currentProject: null,
};

export function getState() { return state; }

export function setState(updates) {
  Object.assign(state, updates);
}
