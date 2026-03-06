'use strict';

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(`[error] ${req.method} ${req.path}:`, err.message);

  // Map WebSocket errors to appropriate HTTP status
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (message.includes('WebSocket') || message.includes('not connected')) {
    status = 502;
    message = 'Lost connection to Huly server. Please try again or re-login.';
  } else if (message.includes('timed out')) {
    status = 504;
    message = 'Huly server did not respond in time. Please try again.';
  }

  res.status(status).json({
    ok: false,
    error: message,
  });
}

module.exports = errorHandler;
