'use strict';

async function _post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (json.error) {
    const msg = typeof json.error === 'object' ? JSON.stringify(json.error) : json.error;
    throw Object.assign(new Error(msg), { statusCode: res.status });
  }

  if (!json.result) {
    throw Object.assign(new Error('Empty result from Huly accounts service'), { statusCode: 502 });
  }

  return json.result;
}

async function login(hulyUrl, email, password) {
  const result = await _post(`${hulyUrl}/_accounts`, {
    method: 'login',
    params: [email, password],
  });

  if (!result.token) {
    throw Object.assign(new Error('Login failed: no token returned'), { statusCode: 401 });
  }

  return { token: result.token, email: result.email };
}

async function selectWorkspace(hulyUrl, token, workspace) {
  const result = await _post(`${hulyUrl}/_accounts`, {
    method: 'selectWorkspace',
    params: [token, workspace],
  });

  if (!result.endpoint || !result.token) {
    throw Object.assign(new Error('selectWorkspace failed: missing endpoint or token'), { statusCode: 502 });
  }

  return { endpoint: result.endpoint, token: result.token };
}

module.exports = { login, selectWorkspace };
