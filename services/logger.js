const crypto = require('crypto');
const morgan = require('morgan');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Creates structured JSON log object or formatted message
 */
function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  if (isProd || process.env.STRUCTURED_LOGS === 'true') {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
  }
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

const logger = {
  info: (msg, meta) => console.log(formatLog('info', msg, meta)),
  warn: (msg, meta) => console.warn(formatLog('warn', msg, meta)),
  error: (msg, meta) => console.error(formatLog('error', msg, meta))
};

/**
 * Express middleware: attaches a unique Request ID (UUID) to every incoming request.
 * Propagates existing X-Request-Id header from upstream proxies (Cloudflare, AWS ALB, Nginx)
 * or creates a new cryptographically secure UUID.
 */
function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = (typeof incomingId === 'string' && incomingId.trim()) 
    ? incomingId.trim() 
    : crypto.randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Attach scoped logger to request object
  req.log = {
    info: (msg, meta = {}) => logger.info(msg, { requestId, path: req.path, method: req.method, ...meta }),
    warn: (msg, meta = {}) => logger.warn(msg, { requestId, path: req.path, method: req.method, ...meta }),
    error: (msg, meta = {}) => logger.error(msg, { requestId, path: req.path, method: req.method, ...meta })
  };

  next();
}

/**
 * Registers custom Morgan tokens and returns configured Morgan HTTP logging middleware.
 */
function setupMorganLogger() {
  morgan.token('req-id', (req) => req.id || '-');
  morgan.token('client-ip', (req) => {
    return req.headers['cf-connecting-ip'] || 
           req.headers['x-forwarded-for']?.split(',')[0].trim() || 
           req.socket?.remoteAddress || 
           '-';
  });

  if (isProd || process.env.STRUCTURED_LOGS === 'true') {
    // Structured JSON access log
    return morgan((tokens, req, res) => {
      return JSON.stringify({
        timestamp: tokens.date(req, res, 'iso'),
        level: 'http',
        requestId: tokens['req-id'](req, res),
        clientIp: tokens['client-ip'](req, res),
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: Number(tokens.status(req, res)),
        responseTimeMs: parseFloat(tokens['response-time'](req, res)),
        contentLength: tokens.res(req, res, 'content-length') || '0',
        userAgent: tokens['user-agent'](req, res)
      });
    });
  }

  // Readable standard combined log with Request ID for development
  return morgan(':date[iso] [:req-id] :method :url :status :response-time ms - :res[content-length] (from :client-ip)');
}

module.exports = {
  logger,
  requestIdMiddleware,
  setupMorganLogger
};
