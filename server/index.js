'use strict';

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');

const SessionManager = require('./services/session_manager');
const requireSession = require('./middleware/require_session');
const errorHandler = require('./middleware/error_handler');
const loginRateLimiter = require('./middleware/rate_limiter');

const authRouter = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const issuesRouter = require('./routes/issues');
const metaRouter = require('./routes/meta');

const HULY_URL = process.env.HULY_URL || 'http://localhost';
const HULY_WORKSPACE = process.env.HULY_WORKSPACE || '';
const PORT = parseInt(process.env.PORT || '3000', 10);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MINUTES = parseInt(process.env.SESSION_TTL_MINUTES || '30', 10);

const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts in the SPA
}));
app.use(express.json());
app.use(cookieParser(SESSION_SECRET));

const sessionManager = new SessionManager(SESSION_TTL_MINUTES);
sessionManager.startSweep();

const authRoutes = authRouter({ sessionManager, hulyUrl: HULY_URL, workspace: HULY_WORKSPACE });
const protect = requireSession(sessionManager);

// Auth routes (login has rate limiter, logout/me do not require rate limiting)
app.post('/api/auth/login', loginRateLimiter, authRoutes);
app.use('/api/auth', authRoutes);

app.use('/api/projects', protect, projectsRouter());
app.use('/api/issues', protect, issuesRouter());
app.use('/api/meta', protect, metaRouter());

// Static files
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// SPA fallback for non-API routes
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[huly-task-portal] Listening on port ${PORT}`);
  console.log(`[huly-task-portal] Huly URL: ${HULY_URL} | Workspace: ${HULY_WORKSPACE}`);
  if (!process.env.SESSION_SECRET) {
    console.warn('[huly-task-portal] SESSION_SECRET not set — using ephemeral secret, sessions will not survive restart');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  sessionManager.stopSweep();
  process.exit(0);
});

process.on('SIGINT', () => {
  sessionManager.stopSweep();
  process.exit(0);
});
