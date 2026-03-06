/**
 * api.js - Fetch wrapper for the Task Portal REST API.
 * All responses follow {ok, data} or {ok, error} shape.
 */

async function request(method, url, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    throw new Error(`Network error: ${err.message}`);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server returned non-JSON response (${res.status})`);
  }

  if (!json.ok) {
    if (res.status === 401) {
      // Let the router handle the redirect; return undefined so callers
      // can distinguish a session miss from a real error.
      window.location.hash = '#login';
      return undefined;
    }
    throw new Error(json.error || `Request failed (${res.status})`);
  }

  return json.data;
}

export const api = {
  login:       (email, password) => request('POST', '/api/auth/login', { email, password }),
  logout:      ()                => request('POST', '/api/auth/logout'),
  me:          ()                => request('GET',  '/api/auth/me'),
  projects:    ()                => request('GET',  '/api/projects'),
  issues:      (projectId)       => request('GET',  `/api/issues/project/${projectId}`),
  createIssue: (data)            => request('POST', '/api/issues', data),
  updateIssue: (id, data)        => request('PATCH', `/api/issues/${id}`, data),
  deleteIssue: (id)              => request('DELETE', `/api/issues/${id}`),
  members:     ()                => request('GET',  '/api/meta/members'),
  statuses:    ()                => request('GET',  '/api/meta/statuses'),
};
