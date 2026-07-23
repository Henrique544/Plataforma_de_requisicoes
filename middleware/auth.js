const jwt = require('jsonwebtoken');
const User = require('../models/User');

const sanitizeToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  if (!/^[A-Za-z0-9\-_\.]+$/.test(token)) return null;
  return token;
};

const extractToken = (req) => {
  if (req.cookies && req.cookies.token) {
    return sanitizeToken(req.cookies.token);
  }
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return sanitizeToken(req.headers.authorization.split(' ')[1]);
  }
  return null;
};

const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ success: false, message: 'Acesso não autorizado. Faça login.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Sessão expirada. Faça login novamente.' });
      }
      return res.status(401).json({ success: false, message: 'Token inválido.' });
    }

    if (!decoded.id || typeof decoded.id !== 'string') {
      return res.status(401).json({ success: false, message: 'Token inválido.' });
    }

    const user = await User.findById(decoded.id).select('+loginAttempts +lockUntil');

    if (!user || !user.ativo) {
      return res.status(401).json({ success: false, message: 'Utilizador não encontrado ou inativo.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Acesso negado. Requer perfil: ${roles.join(' ou ')}.`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };