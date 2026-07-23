const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Material = require('../models/Material');
const Aquisicao = require('../models/Aquisicao');
const { protect, authorize } = require('../middleware/auth');

const validateObjectId = param('id').isMongoId().withMessage('ID inválido');

const materialValidation = [
  body('nome').trim().isLength({ min: 2, max: 200 }).withMessage('Nome deve ter entre 2 e 200 caracteres'),
  body('descricao').optional().trim().isLength({ max: 1000 }).withMessage('Descrição muito longa'),
  body('categoria').isIn(['Multimédia', 'STEM', 'Programação e Robótica', 'Outros'])
    .withMessage('Categoria inválida'),
  body('quantidade').isInt({ min: 1, max: 990 }).withMessage('Quantidade inválida'),
  body('icone').optional().trim().isLength({ max: 10 }).withMessage('Ícone inválido'),
  body('status').optional().isIn(['disponivel', 'indisponivel', 'manutencao']).withMessage('Status inválido'),
  body('escola').optional().isIn(['rainha', 'eugenio']).withMessage('Escola inválida')
];

// admin e gestor veem todas as escolas; restantes só veem a sua
const escolaFilter = (user) => (user.role === 'admin' || user.role === 'gestor') ? {} : { escola: user.escola };

router.get('/', protect, async (req, res) => {
  try {
    const { categoria, status, search, escola, page = 1, limit = 20 } = req.query;

    const filter = { ativo: true, ...escolaFilter(req.user) };

    // Admin e gestor podem filtrar por escola (os restantes já estão limitados à sua)
    if ((req.user.role === 'admin' || req.user.role === 'gestor')
        && escola && ['rainha', 'eugenio'].includes(escola)) {
      filter.escola = escola;
    }

    if (categoria && ['Multimédia','STEM','Programação e Robótica','Outros'].includes(categoria)) {
      filter.categoria = categoria;
    }
    if (status && ['disponivel','indisponivel','manutencao'].includes(status)) {
      filter.status = status;
    }
    if (search && typeof search === 'string') {
  const term = search.trim();
  if (term.length >= 2 && term.length <= 100) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.nome = { $regex: escaped, $options: 'i' };
  }
}

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit) || 20));

    const [materials, total] = await Promise.all([
      Material.find(filter)
        .populate('criadoPor', 'nome role')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Material.countDocuments(filter)
    ]);

    return res.status(200).json({ success: true, total, page: pageNum, pages: Math.ceil(total / limitNum), materials });
  } catch (error) {
    console.error('Get materials error:', error.message);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.get('/:id', protect, validateObjectId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'ID inválido.' });

    const material = await Material.findOne({
      _id: req.params.id,
      ativo: true,
      ...escolaFilter(req.user)
    })
      .populate('criadoPor', 'nome role')
      .lean();

    if (!material) return res.status(404).json({ success: false, message: 'Material não encontrado.' });

    const activeAquisicoes = await Aquisicao.find({
      material: material._id,
      status: { $in: ['aprovado', 'em_uso', 'pendente'] }
    })
    .populate('solicitante', 'nome role numero')
    .populate('aprovadoPor', 'nome')
    .sort({ dataInicio: 1 })
    .lean();

    return res.status(200).json({ success: true, material, activeAquisicoes });
  } catch (error) {
    console.error('Get material error:', error.message);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.post('/', protect, authorize('admin'), materialValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

    const { nome, descricao, categoria, quantidade, icone, status, escola } = req.body;

    const escolaDestino = escola || req.user.escola;

    const material = await Material.create({
      nome, descricao, categoria, quantidade,
      quantidadeDisponivel: quantidade,
      icone: icone || '📦',
      status: status || 'disponivel',
      escola: escolaDestino,
      criadoPor: req.user._id
    });

    return res.status(201).json({ success: true, message: 'Material criado com sucesso.', material });
  } catch (error) {
    console.error('Create material error:', error.message);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.put('/:id', protect, authorize('admin'), validateObjectId, materialValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

    const allowedFields = ['nome', 'descricao', 'categoria', 'quantidade', 'quantidadeDisponivel', 'icone', 'status', 'escola'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    const filter = { _id: req.params.id, ...escolaFilter(req.user) };

    const material = await Material.findOneAndUpdate(
      filter,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!material) return res.status(404).json({ success: false, message: 'Material não encontrado.' });

    return res.status(200).json({ success: true, message: 'Material atualizado.', material });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.delete('/:id', protect, authorize('admin'), validateObjectId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'ID inválido.' });

    const filter = { _id: req.params.id, ...escolaFilter(req.user) };

    const material = await Material.findOneAndUpdate(
      filter,
      { $set: { ativo: false } },
      { new: true }
    );

    if (!material) return res.status(404).json({ success: false, message: 'Material não encontrado.' });

    return res.status(200).json({ success: true, message: 'Material eliminado com sucesso.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

module.exports = router;