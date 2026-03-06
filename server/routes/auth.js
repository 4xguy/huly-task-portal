'use strict';

const { Router } = require('express');
const { login, selectWorkspace } = require('../services/huly_auth');
const HulyConnection = require('../services/huly_connection');
const { CLASSES, parsePersonName, parseQueryResult } = require('../adapters/huly_adapter');
const requireSession = require('../middleware/require_session');

const COOKIE_NAME = 'session_id';
const COOKIE_OPTS = {
  httpOnly: true,
  signed: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: parseInt(process.env.SESSION_TTL_MINUTES || '30', 10) * 60 * 1000,
};

function authRouter({ sessionManager, hulyUrl, workspace }) {
  const router = Router();

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ ok: false, error: 'email and password are required' });
      }

      const { token: accountToken } = await login(hulyUrl, email, password);
      const { endpoint, token: workspaceToken } = await selectWorkspace(hulyUrl, accountToken, workspace);

      const conn = new HulyConnection(endpoint, workspaceToken);
      await conn.connect();

      // Fetch the PersonAccount to get memberId
      const accounts = await conn.findAll(CLASSES.PersonAccount, { email });
      const account = accounts[0];
      if (!account) {
        conn.close();
        return res.status(403).json({ ok: false, error: 'Account not found in workspace' });
      }

      let personName = email;
      if (account.person) {
        const persons = await conn.findAll(CLASSES.Person, { _id: account.person });
        if (persons[0]) {
          personName = parsePersonName(persons[0].name);
        }
      }

      const sessionId = sessionManager.create({
        email,
        memberId: account._id,
        personName,
        accountToken,
        workspaceToken,
        hulyConnection: conn,
      });

      res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTS);
      res.json({ ok: true, data: { email, name: personName } });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', (req, res) => {
    const sessionId = req.signedCookies && req.signedCookies[COOKIE_NAME];
    if (sessionId) {
      sessionManager.destroy(sessionId);
    }
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });

  router.get('/me', requireSession(sessionManager), (req, res) => {
    const { email, personName } = req.session;
    res.json({ ok: true, data: { email, name: personName } });
  });

  return router;
}

module.exports = authRouter;
