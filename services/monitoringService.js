const Sentry = require('@sentry/node');

let sentryInitialized = false;

/**
 * Initializes Sentry error monitoring behind an environment flag.
 * If ENABLE_SENTRY is not 'true' or SENTRY_DSN is not provided,
 * Sentry gracefully remains disabled without throwing errors.
 */
function initMonitoring() {
  const isEnabled = process.env.ENABLE_SENTRY === 'true';
  const dsn = (process.env.SENTRY_DSN || '').trim();

  if (!isEnabled || !dsn) {
    console.log('🛡️ [Monitoring] Sentry is disabled (ENABLE_SENTRY != true or SENTRY_DSN unset). Local structured logging active.');
    return false;
  }

  try {
    const environment = process.env.NODE_ENV || 'development';
    const sampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.2');

    Sentry.init({
      dsn,
      environment,
      tracesSampleRate: isNaN(sampleRate) ? 0.2 : sampleRate,
      beforeSend(event) {
        // Strip sensitive fields (passwords, OTPs, auth tokens, secret keys)
        if (event.request && event.request.data) {
          const sensitiveKeys = ['password', 'confirmPassword', 'otp', 'resetToken', 'token', 'secret'];
          for (const key of sensitiveKeys) {
            if (event.request.data[key]) {
              event.request.data[key] = '[REDACTED]';
            }
          }
        }
        return event;
      }
    });

    sentryInitialized = true;
    console.log(`🛡️ [Monitoring] Sentry error monitoring initialized successfully (env: ${environment}, traces: ${sampleRate}).`);
    return true;
  } catch (err) {
    console.error('⚠️ [Monitoring] Failed to initialize Sentry:', err.message);
    sentryInitialized = false;
    return false;
  }
}

/**
 * Checks if Sentry is currently active
 */
function isSentryActive() {
  return sentryInitialized;
}

/**
 * Captures an error exception with optional structured metadata context.
 * Forwards to Sentry when active and outputs structured error logs.
 *
 * @param {Error|string} error - The caught exception
 * @param {Object} [context={}] - Optional metadata (requestId, route, userId, ip)
 */
function captureException(error, context = {}) {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  const logPayload = {
    level: 'error',
    event: 'exception_captured',
    message: errorMessage,
    timestamp,
    ...context
  };

  // Structured local error output
  console.error(`🚨 [Exception] ${errorMessage}:`, JSON.stringify(logPayload));
  if (errorStack && process.env.NODE_ENV !== 'production') {
    console.error(errorStack);
  }

  // Forward to Sentry if active
  if (sentryInitialized) {
    try {
      Sentry.withScope(scope => {
        if (context.requestId) scope.setTag('requestId', context.requestId);
        if (context.route) scope.setTag('route', context.route);
        if (context.userId) scope.setUser({ id: context.userId });
        if (context.ip) scope.setExtra('client_ip', context.ip);
        Object.entries(context).forEach(([k, v]) => {
          if (!['requestId', 'route', 'userId', 'ip'].includes(k)) {
            scope.setExtra(k, v);
          }
        });
        Sentry.captureException(error);
      });
    } catch (sentryErr) {
      console.error('⚠️ [Monitoring] Sentry captureException error:', sentryErr.message);
    }
  }
}

/**
 * Express middleware for Sentry request handling
 */
function sentryRequestHandler() {
  if (sentryInitialized && typeof Sentry.Handlers?.requestHandler === 'function') {
    return Sentry.Handlers.requestHandler();
  }
  return (req, res, next) => next();
}

/**
 * Express middleware for Sentry error handling
 */
function sentryErrorHandler() {
  if (sentryInitialized && typeof Sentry.Handlers?.errorHandler === 'function') {
    return Sentry.Handlers.errorHandler();
  }
  return (err, req, res, next) => next(err);
}

module.exports = {
  initMonitoring,
  isSentryActive,
  captureException,
  sentryRequestHandler,
  sentryErrorHandler
};
