const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const LogSeguranca = require('../models/logs_seguranca');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');


const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.MAIL_PORT || '587'),
  secure: process.env.MAIL_PORT === '465',
  auth:   { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

async function sendMail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || `"Agrupamento de Escolas Rainha Dona Leonor" <${process.env.MAIL_USER}>`,
      to, subject, html,
    });
    console.log(`Email: ${subject} → ${to}`);
  } catch (err) {
    console.error(`❌ Mailer [${subject}]:`, err.message);
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c])
);

// base de email
function emailBase(body) {
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#1a2a4a;border-radius:10px 10px 0 0;padding:28px 36px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Agrupamento de Escolas Rainha Dona Leonor</h1>
    <p style="color:#8fa8c8;margin:6px 0 0;font-size:13px;">Sistema de Requisições</p>
  </td></tr>
  <tr><td style="background:#fff;padding:36px;color:#333;font-size:15px;line-height:1.6;">
    ${body}
  </td></tr>
  <tr><td style="background:#f5f7fa;border-radius:0 0 10px 10px;padding:18px 36px;text-align:center;color:#aaa;font-size:12px;">
    <p style="margin:0">Email automático — não responda a esta mensagem.</p>
    <p style="margin:6px 0 0">© ${new Date().getFullYear()} Agrupamento de Escolas Rainha Dona Leonor</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId.toString() },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      algorithm: 'HS256'
    }
  );
};

const setCookieToken = (res, token) => {
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  };
  res.cookie('token', token, cookieOptions);
};


router.post('/login', authLimiter, [
  body('email')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail()
    .isLength({ max: 150 }).withMessage('Email muito longo'),
  body('password')
    .isString().withMessage('Password inválida')
    .isLength({ min: 1, max: 128 }).withMessage('Password inválida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

    if (!user) {
      LogSeguranca.registarReq(req, {
        evento: 'login_falhado',
        severidade: 'aviso',
        emailTentativa: email,
        motivo: 'Utilizador inexistente'
      });
      return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
    }

    if (user.isLocked()) {
      LogSeguranca.registarReq(req, {
        evento: 'login_falhado',
        severidade: 'aviso',
        user: user._id,
        emailTentativa: email,
        motivo: 'Tentativa de login em conta bloqueada'
      });
      const unlockTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Conta bloqueada. Tente novamente em ${unlockTime} minuto(s).`
      });
    }

    if (!user.ativo) {
      LogSeguranca.registarReq(req, {
        evento: 'login_falhado',
        severidade: 'aviso',
        user: user._id,
        emailTentativa: email,
        motivo: 'Conta inativa'
      });
      return res.status(401).json({ success: false, message: 'Conta inativa. Contacte o administrador.' });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      await user.incLoginAttempts();

      const updated = await User.findById(user._id).select('+loginAttempts +lockUntil');
      const acabouDeBloquear = updated?.lockUntil && updated.lockUntil > Date.now();

      LogSeguranca.registarReq(req, {
        evento: acabouDeBloquear ? 'conta_bloqueada' : 'login_falhado',
        severidade: acabouDeBloquear ? 'critico' : 'aviso',
        user: user._id,
        emailTentativa: email,
        motivo: acabouDeBloquear
          ? 'Conta bloqueada após 5 tentativas falhadas'
          : 'Password incorreta',
        detalhes: { tentativas: updated?.loginAttempts ?? null }
      });

      return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
    }

    await User.findByIdAndUpdate(user._id, {
      $set: { loginAttempts: 0, lastLogin: new Date() },
      $unset: { lockUntil: 1 }
    });

    const token = generateToken(user._id);
    setCookieToken(res, token);

    LogSeguranca.registarReq(req, {
      evento: 'login_sucesso',
      user: user._id,
      motivo: 'Login efetuado com sucesso'
    });

    return res.status(200).json({
      success: true,
      message: 'Login efetuado com sucesso.',
      token,
      user: user.toPublicJSON()
    });

  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.post('/logout', protect, (req, res) => {
  res.cookie('token', '', {
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });

  LogSeguranca.registarReq(req, {
    evento: 'logout',
    user: req.user._id,
    motivo: 'Logout efetuado'
  });

  return res.status(200).json({ success: true, message: 'Logout efetuado com sucesso.' });
});

router.get('/me', protect, (req, res) => {
  return res.status(200).json({ success: true, user: req.user.toPublicJSON() });
});

router.post('/register', authLimiter, [
  body('nome')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/).withMessage('Nome contém caracteres inválidos'),
  body('email')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail()
    .isLength({ max: 150 }),
body('password')
    .isLength({ min: 8, max: 128 }).withMessage('Password deve ter entre 8 e 128 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password deve conter maiúscula, minúscula e número'),
  body('numero')
    .optional()
    .trim()
    .isAlphanumeric('pt-PT', { ignore: '-' }).withMessage('Número inválido')
    .isLength({ max: 20 }),
  body('escola')
    .isIn(['rainha', 'eugenio']).withMessage('Escola inválida'),
 ], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { nome, email, password, escola, numero } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email já registado.' });
    }

    await User.create({ nome, email, password, role: 'aluno', numero, escola, ativo: false });

    return res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso. Aguarde ativação pelo administrador.'
    });

  } catch (error) {
    console.error('Register error:', error.message);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email já registado.' });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

module.exports = router;