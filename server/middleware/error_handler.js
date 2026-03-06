'use strict';

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[error]', err.message, err.stack ? '\n' + err.stack : '');

  const status = err.statusCode || 500;
  res.status(status).json({
    ok: false,
    error: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
