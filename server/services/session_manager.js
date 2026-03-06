'use strict';

const { v4: uuidv4 } = require('uuid');

class SessionManager {
  constructor(ttlMinutes = 30) {
    this._ttlMs = ttlMinutes * 60 * 1000;
    this._sessions = new Map();
    this._sweepInterval = null;
  }

  create(sessionData) {
    const sessionId = uuidv4();
    this._sessions.set(sessionId, {
      ...sessionData,
      sessionId,
      lastActivity: Date.now(),
    });
    return sessionId;
  }

  get(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return null;

    const now = Date.now();
    if (now - session.lastActivity > this._ttlMs) {
      this.destroy(sessionId);
      return null;
    }

    session.lastActivity = now;
    return session;
  }

  destroy(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return;

    if (session.hulyConnection) {
      try { session.hulyConnection.close(); } catch {}
    }

    this._sessions.delete(sessionId);
  }

  startSweep() {
    this._sweepInterval = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this._sessions) {
        if (now - session.lastActivity > this._ttlMs) {
          this.destroy(sessionId);
        }
      }
    }, 60 * 1000);

    // Allow process to exit even if sweep is active
    if (this._sweepInterval.unref) {
      this._sweepInterval.unref();
    }
  }

  stopSweep() {
    if (this._sweepInterval) {
      clearInterval(this._sweepInterval);
      this._sweepInterval = null;
    }
  }
}

module.exports = SessionManager;
