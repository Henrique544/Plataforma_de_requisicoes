const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const validateObjectId = param('id').isMongoId().withMessage('ID inválido');


router.get('/professores', protect, async (req, res) => {
  try {
    const { search } = req.query;

    const filter = { role: 'professor', ativo: true };

    if (search && typeof search === 'string' && search.trim()) {
      const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.nome = { $regex: safe, $options: 'i' };
    }

    const professores = await User.find(filter)
      .select('_id nome escola')    
      .sort({ nome: 1 })
      .limit(200)
      .lean();

    return res.status(200).json({ success: true, total: professores.length, professores });
  } catch (error) {
    console.error('Get professores error:', error.message);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.get('/', protect, authorize('admin', 'gestor'), async (req, res) => {
  try {
    const { role, ativo, page = 1, limit = 20 } = req.query;
    
    const filter = {};
    if (role && ['aluno', 'professor', 'gestor', 'admin'].includes(role)) filter.role = role;
    if (ativo !== undefined) filter.ativo = ativo === 'true';

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -loginAttempts -lockUntil')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      users
    });
  } catch (error) {
    console.error('Get users error:', error.message);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.get('/:id', protect, authorize('admin', 'gestor'), validateObjectId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'ID inválido.' });

    const user = await User.findById(req.params.id).select('-password -loginAttempts -lockUntil');
    if (!user) return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });

    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.put('/:id', protect, authorize('admin'), validateObjectId, [
  body('nome').optional().trim()
    .isLength({ min: 2, max: 100 }).withMessage('Nome inválido')
    .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/).withMessage('Nome contém caracteres inválidos'),
  body('role').optional().isIn(['aluno', 'professor', 'gestor', 'admin']).withMessage('Role inválido'),
  body('ativo').optional().isBoolean().withMessage('Ativo deve ser boolean'),
  body('escola').optional().isIn(['rainha', 'eugenio']).withMessage('Escola inválida'),
  body('numero').optional().trim().isAlphanumeric('pt-PT', { ignore: '-' }).isLength({ max: 20 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

    const allowedFields = ['nome', 'role', 'ativo', 'numero', 'escola'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    if (req.params.id === req.user._id.toString() && updateData.role && updateData.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Não pode alterar o seu próprio perfil de admin.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -loginAttempts -lockUntil');

    if (!user) return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });

    return res.status(200).json({ success: true, message: 'Utilizador atualizado.', user });
  } catch (error) {
    console.error('Update user error:', error.message);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.delete('/:id', protect, authorize('admin'), validateObjectId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'ID inválido.' });

    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Não pode eliminar a sua própria conta.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { $set: { ativo: false } }, 
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });

    return res.status(200).json({ success: true, message: 'Utilizador desativado com sucesso.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.post('/', protect, authorize('admin'), [
  body('nome').trim()
    .isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/).withMessage('Nome contém caracteres inválidos'),
  body('email').isEmail().withMessage('Email inválido').normalizeEmail().isLength({ max: 150 }),
  body('password')
    .isLength({ min: 8, max: 128 }).withMessage('Password deve ter entre 8 e 128 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password deve conter maiúscula, minúscula e número'),
  body('role').isIn(['aluno', 'professor', 'gestor', 'admin']).withMessage('Role inválido'),
  body('escola').optional().isIn(['rainha', 'eugenio']).withMessage('Escola inválida'),
  body('numero').optional().trim().isAlphanumeric('pt-PT', { ignore: '-' }).isLength({ max: 20 }),
  body('ativo').optional().isBoolean().withMessage('Ativo deve ser boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

    const { nome, email, password, role, escola, numero, ativo } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: 'Email já registado.' });

    const user = await User.create({
      nome, email, password, role, numero,
      escola: escola || req.user.escola,
      ativo: ativo === undefined ? true : ativo
    });

    return res.status(201).json({
      success: true,
      message: 'Utilizador criado com sucesso.',
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Create user error:', error.message);
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Email já registado.' });
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

module.exports = router;