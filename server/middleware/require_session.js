'use strict';

function requireSession(sessionManager) {
  return function (req, res, next) {
    const sessionId = req.signedCookies && req.signedCookies.session_id;
    if (!sessionId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const session = sessionManager.get(sessionId);
    if (!session) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    req.session = session;
    next();
  };
}

module.exports = requireSession;
