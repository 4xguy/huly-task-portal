/**
 * login.js - Login form view.
 * renderLogin(container) - renders into the given DOM element.
 */

import { api } from '../api.js';
import { getState, setState } from '../state.js';
import { showToast } from '../components/toast.js';

export function renderLogin(container) {
  // Redirect if already authenticated.
  if (getState().user) {
    window.location.hash = '#projects';
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'login-wrapper';

  wrapper.innerHTML = `
    <div class="login-card">
      <h2>Task Portal</h2>
      <div class="error-msg" id="login-error" hidden></div>
      <form id="login-form" novalidate>
        <label>
          Email
          <input type="email" name="email" required autocomplete="email" placeholder="you@example.com">
        </label>
        <label>
          Password
          <input type="password" name="password" required autocomplete="current-password" placeholder="Password">
        </label>
        <button type="submit" id="login-btn">Sign in</button>
      </form>
    </div>
  `;

  container.appendChild(wrapper);

  const form     = wrapper.querySelector('#login-form');
  const errorEl  = wrapper.querySelector('#login-error');
  const loginBtn = wrapper.querySelector('#login-btn');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const email    = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      showError('Please enter your email and password.');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.setAttribute('aria-busy', 'true');
    loginBtn.textContent = 'Signing in…';

    try {
      const user = await api.login(email, password);
      setState({ user });
      showToast('Welcome back!', 'success');
      window.location.hash = '#projects';
    } catch (err) {
      showError(err.message || 'Login failed. Check your credentials.');
      loginBtn.disabled = false;
      loginBtn.removeAttribute('aria-busy');
      loginBtn.textContent = 'Sign in';
    }
  });
}
