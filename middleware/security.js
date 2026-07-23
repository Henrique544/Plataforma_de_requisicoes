const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');


// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Demasiadas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// rate limit para auth routes ( contra força bruta )
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Demasiadas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const helmetConfig = helmet({
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    fontSrc: ["'self'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  }
},
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

const noSQLSanitize = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️  NoSQL injection attempt blocked: key="${key}" IP=${req.ip}`);
  }
});

const xssSanitize = xss();


const stripHTMLTags = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '').replace(/on\w+\s*=/gi, '');
};

const deepSanitize = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return stripHTMLTags(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key of Object.keys(obj)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      sanitized[key] = deepSanitize(obj[key]);
    }
    return sanitized;
  }
  return obj;
};

const sanitizeBody = (req, res, next) => {
  if (req.body) req.body = deepSanitize(req.body);
  if (req.params) req.params = deepSanitize(req.params);
  next();
};

const preventParamPollution = (req, res, next) => {
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (Array.isArray(req.query[key])) {
        req.query[key] = req.query[key][0];
      }
    }
  }
  next();
};

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Powered-By', 'Escola');
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

module.exports = {
  apiLimiter,
  authLimiter,
  helmetConfig,
  noSQLSanitize,
  xssSanitize,
  sanitizeBody,
  preventParamPollution,
  securityHeaders
};
