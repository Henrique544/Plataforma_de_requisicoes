const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const Aquisicao = require('../models/Aquisicao');
const Material = require('../models/Material');
const User = require('../models/User');
const cron = require('node-cron');
const { protect, authorize } = require('../middleware/auth');

// ─── Nodemailer ───────────────────────────────────────────────────────────────
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

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' }); }
  catch { return '—'; }
}

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

function blocoMaterial(aq) {
  const codigos = aq.codigosUnidades?.length
    ? `<tr><td style="padding:5px 0;color:#666;width:45%">Código(s) atribuído(s)</td>
       <td style="padding:5px 0;font-weight:600;font-family:monospace">${esc(aq.codigosUnidades.join(', '))}</td></tr>`
    : '';
  return `
    <div style="background:#f5f7fa;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:20px;">${esc(aq.material?.icone || '📦')} <strong>${esc(aq.material?.nome || '—')}</strong></p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:5px 0;color:#666;width:45%">Quantidade</td>
            <td style="padding:5px 0;font-weight:600">${esc(String(aq.quantidade))}</td></tr>
        ${codigos}
        <tr><td style="padding:5px 0;color:#666">Data início</td>
            <td style="padding:5px 0">${fmtDate(aq.dataInicio)}</td></tr>
        <tr><td style="padding:5px 0;color:#666">Data devolução</td>
            <td style="padding:5px 0">${fmtDate(aq.dataFim)}</td></tr>
        ${aq.professor ? `<tr><td style="padding:5px 0;color:#666">Professor responsável</td><td style="padding:5px 0">${esc(aq.professor?.nome || '—')}</td></tr>` : ''}
        ${aq.motivo ? `<tr><td style="padding:5px 0;color:#666">Motivo</td><td style="padding:5px 0">${esc(aq.motivo)}</td></tr>` : ''}
      </table>
    </div>`;
}

const btnEntrar = (label = 'Ver Requisições →') => {
  const url = process.env.APP_URL || 'http://localhost:3000';
  return `<div style="text-align:center;margin:28px 0">
    <a href="${url}" style="background:#1a2a4a;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;">${label}</a>
  </div>`;
};

const validateObjectId = param('id').isMongoId().withMessage('ID inválido');

async function reservarUnidades(materialId, quantidade) {
  const material = await Material.findById(materialId);
  if (!material) return null;
  if (material.quantidadeDisponivel < quantidade) return null;

  if (material.unidades && material.unidades.length > 0) {
    const disponiveis = material.unidades.filter(u => u.status === 'disponivel');
    if (disponiveis.length < quantidade) return null;

    const escolhidas = disponiveis.slice(0, quantidade);
    const codigos = escolhidas.map(u => u.codigo);

    await Material.updateOne(
      { _id: materialId },
      { $set: { 'unidades.$[elem].status': 'requisitado' } },
      { arrayFilters: [{ 'elem.codigo': { $in: codigos } }] }
    );
    await Material.findByIdAndUpdate(materialId, {
      $inc: { quantidadeDisponivel: -quantidade }
    });
    return codigos;
  }

  await Material.findByIdAndUpdate(materialId, {
    $inc: { quantidadeDisponivel: -quantidade }
  });
  return []; 
}


async function libertarUnidades(materialId, codigos, quantidade) {
  await Material.findByIdAndUpdate(materialId, {
    $inc: { quantidadeDisponivel: quantidade }
  });

  if (codigos && codigos.length > 0) {
    await Material.updateOne(
      { _id: materialId },
      { $set: { 'unidades.$[elem].status': 'disponivel' } },
      { arrayFilters: [{ 'elem.codigo': { $in: codigos } }] }
    );
  }
}

router.get('/', protect, async (req, res) => {
  try {
    await marcarExpiradasPorEntregar();

    const { status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (req.user.role === 'aluno') {
      filter.solicitante = req.user._id;
    } else if (req.user.role === 'professor') {
      filter.$or = [
        { solicitante: req.user._id },
        { professor: req.user._id }
      ];
    }
    if (status && ['pendente','aprovado','em_uso','por_entregar','devolvido','rejeitado','cancelado'].includes(status)) {
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const podeVerObs = ['admin', 'gestor'].includes(req.user.role);

    const query = Aquisicao.find(filter)
      .populate('material', 'nome icone categoria')
      .populate('solicitante', 'nome role numero')
      .populate('professor', 'nome')
      .populate('aprovadoPor', 'nome')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    if (!podeVerObs) query.select('-observacaoAdmin');

    const [aquisicoes, total] = await Promise.all([
      query.lean(),
      Aquisicao.countDocuments(filter)
    ]);

    return res.status(200).json({ success: true, total, page: pageNum, pages: Math.ceil(total / limitNum), aquisicoes });
  } catch (error) {
    console.error('Get aquisicoes error:', error.message);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.get('/pendentes', protect, async (req, res) => {
  try {
    if (!['admin', 'professor'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Sem permissão.' });
    }

    const filter = { status: 'pendente', requerAprovacao: true };
    if (req.user.role === 'professor') filter.professor = req.user._id;

    const pendentes = await Aquisicao.find(filter)
      .populate('material', 'nome icone categoria quantidadeDisponivel')
      .populate('solicitante', 'nome role numero email')
      .populate('professor', 'nome')
      .select('-observacaoAdmin')
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({ success: true, pendentes });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.post('/', protect, [
  body('material').isMongoId().withMessage('Material inválido'),
  body('professor').isMongoId().withMessage('Professor inválido'),
  body('quantidade').isInt({ min: 1, max: 999 }).withMessage('Quantidade deve ser entre 1 e 999'),
  body('motivo').trim().isLength({ min: 10, max: 500 }).withMessage('Motivo deve ter entre 10 e 500 caracteres'),
  body('dataInicio').isISO8601().withMessage('Data de início inválida').toDate(),
  body('dataFim').isISO8601().withMessage('Data de fim inválida').toDate()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

    const { material: materialId, professor: professorId, quantidade, motivo, dataInicio, dataFim } = req.body;

    const professor = await User.findOne({ _id: professorId, role: 'professor', ativo: true }).select('_id nome email');
    if (!professor) return res.status(400).json({ success: false, message: 'Professor inválido ou inativo.' });

    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const now = new Date(); now.setHours(0,0,0,0);

    if (inicio < now) return res.status(400).json({ success: false, message: 'Data de início não pode ser no passado.' });
    if (fim <= inicio) return res.status(400).json({ success: false, message: 'Data de fim deve ser posterior à data de início.' });

    // Limite máximo de 1 semana (7 dias)
    const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
    if (fim.getTime() - inicio.getTime() > UMA_SEMANA_MS) {
      return res.status(400).json({ success: false, message: 'O período máximo de uma requisição é de 1 semana (7 dias).' });
    }

    const material = await Material.findOne({ _id: materialId, ativo: true });
    if (!material) return res.status(404).json({ success: false, message: 'Material não encontrado.' });
    if (material.status !== 'disponivel') return res.status(400).json({ success: false, message: 'Material não está disponível.' });
    if (material.quantidadeDisponivel < quantidade) {
      return res.status(400).json({ success: false, message: `Quantidade insuficiente. Disponível: ${material.quantidadeDisponivel}` });
    }

    const requerAprovacao = req.user.role === 'aluno';
    const initialStatus   = requerAprovacao ? 'pendente' : 'aprovado';

    let codigosUnidades = [];
    if (!requerAprovacao) {
      const codigos = await reservarUnidades(materialId, quantidade);
      if (!codigos) return res.status(400).json({ success: false, message: 'Não foi possível reservar unidades. Tente novamente.' });
      codigosUnidades = codigos;
    }

    const aquisicao = await Aquisicao.create({
      material: materialId,
      solicitante: req.user._id,
      professor: professor._id,
      quantidade,
      codigosUnidades,
      motivo,
      dataInicio: inicio,
      dataFim: fim,
      status: initialStatus,
      requerAprovacao,
      aprovadoPor: requerAprovacao ? null : req.user._id,
      dataAprovacao: requerAprovacao ? null : new Date()
    });

    const populated = await Aquisicao.findById(aquisicao._id)
      .populate('material', 'nome icone categoria')
      .populate('solicitante', 'nome role numero email')
      .populate('professor', 'nome email')
      .lean();

    const solicitante = populated.solicitante;

    sendMail(
      solicitante.email,
      `Requisição recebida — ${populated.material?.nome || 'Material'}`,
      emailBase(`
        <h2 style="color:#1a2a4a;margin-top:0">Requisição recebida!</h2>
        <p>Olá <strong>${esc(solicitante.nome)}</strong>, a sua requisição foi submetida com sucesso.</p>
        ${blocoMaterial(populated)}
        <p style="background:#e3f2fd;border-left:4px solid #2196f3;padding:12px 16px;border-radius:4px;font-size:14px;">
          ${requerAprovacao
            ? 'A sua requisição está <strong>pendente de aprovação</strong>. Será notificado(a) por email quando for processada.'
            : 'A sua requisição foi <strong>aprovada automaticamente</strong>.'}
        </p>
        ${btnEntrar()}
      `)
    );

    if (professor.email) {
      const precisaAprovar = requerAprovacao;
      sendMail(
        professor.email,
        precisaAprovar
          ? `Requisição aguarda a sua aprovação — ${populated.material?.nome || 'Material'}`
          : `Foi indicado(a) numa requisição — ${populated.material?.nome || 'Material'}`,
        emailBase(`
          <h2 style="color:#1a2a4a;margin-top:0">${precisaAprovar ? 'Requisição aguarda a sua aprovação' : 'Foi indicado(a) numa requisição'}</h2>
          <p>Olá <strong>${esc(professor.nome)}</strong>, o(a) utilizador(a)
          <strong>${esc(solicitante.nome)}</strong>${solicitante.numero ? ` (nº ${esc(solicitante.numero)})` : ''}
          indicou-o(a) como professor responsável numa requisição.</p>
          ${blocoMaterial(populated)}
          ${precisaAprovar ? `<p style="background:#fff4e5;border-left:4px solid #ff9800;padding:12px 16px;border-radius:4px;font-size:14px;">
            Esta requisição está <strong>pendente</strong>. Pode aprová-la ou rejeitá-la na plataforma.
          </p>` : ''}
          ${btnEntrar(precisaAprovar ? 'Rever e Aprovar →' : 'Ver Requisições →')}
        `)
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    const message = requerAprovacao
      ? 'Pedido submetido. Aguarda aprovação do administrador.'
      : 'Requisição aprovada automaticamente.';

    return res.status(201).json({ success: true, message, aquisicao: populated });
  } catch (error) {
    console.error('Create aquisicao error:', error.message);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.put('/:id/aprovar', protect, validateObjectId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'ID inválido.' });

    const aquisicao = await Aquisicao.findById(req.params.id);
    if (!aquisicao) return res.status(404).json({ success: false, message: 'Requisição não encontrada.' });
    if (aquisicao.status !== 'pendente') {
      return res.status(400).json({ success: false, message: 'Apenas pedidos pendentes podem ser aprovados.' });
    }

    const isAdmin = req.user.role === 'admin';
    const isAssignedProf = req.user.role === 'professor'
      && aquisicao.professor?.toString() === req.user._id.toString();
    if (!isAdmin && !isAssignedProf) {
      return res.status(403).json({ success: false, message: 'Sem permissão para aprovar esta requisição.' });
    }

    const codigos = await reservarUnidades(aquisicao.material, aquisicao.quantidade);
    if (!codigos) {
      return res.status(400).json({ success: false, message: 'Material sem stock suficiente.' });
    }

    aquisicao.status = 'aprovado';
    aquisicao.aprovadoPor = req.user._id;
    aquisicao.dataAprovacao = new Date();
    aquisicao.codigosUnidades = codigos;
    await aquisicao.save();

    const aqPopulada = await Aquisicao.findById(aquisicao._id)
      .populate('material', 'nome icone')
      .populate('solicitante', 'nome email')
      .populate('professor', 'nome')
      .lean();

    if (aqPopulada?.solicitante?.email) {
      sendMail(
        aqPopulada.solicitante.email,
        `Requisição aprovada — ${aqPopulada.material?.nome || 'Material'}`,
        emailBase(`
          <h2 style="color:#1a2a4a;margin-top:0">Requisição aprovada!</h2>
          <p>Olá <strong>${esc(aqPopulada.solicitante.nome)}</strong>, a sua requisição foi <strong>aprovada</strong>.</p>
          ${blocoMaterial(aqPopulada)}
          <p style="background:#e8f5e9;border-left:4px solid #27ae60;padding:12px 16px;border-radius:4px;font-size:14px;">
            Pode levantar o material no laboratorio LED da escola no horário defenido.
          </p>
          ${btnEntrar()}
        `)
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    return res.status(200).json({ success: true, message: 'Requisição aprovada com sucesso.', codigosUnidades: codigos });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.put('/:id/rejeitar', protect, validateObjectId, [
  body('motivo').optional().trim().isLength({ max: 500 }).withMessage('Motivo muito longo')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

    const aquisicao = await Aquisicao.findById(req.params.id);
    if (!aquisicao) return res.status(404).json({ success: false, message: 'Requisição não encontrada.' });
    if (!['pendente', 'aprovado'].includes(aquisicao.status)) {
      return res.status(400).json({ success: false, message: 'Não é possível rejeitar esta Requisição.' });
    }

    const isAdmin = req.user.role === 'admin';
    const isAssignedProf = req.user.role === 'professor'
      && aquisicao.professor?.toString() === req.user._id.toString();
    if (!isAdmin && !isAssignedProf) {
      return res.status(403).json({ success: false, message: 'Sem permissão para rejeitar esta requisição.' });
    }
    if (!isAdmin && aquisicao.status === 'aprovado') {
      return res.status(403).json({ success: false, message: 'Apenas o administrador pode rejeitar pedidos já aprovados.' });
    }

    const wasApproved = aquisicao.status === 'aprovado';
    aquisicao.status = 'rejeitado';
    aquisicao.motivoRejeicao = req.body.motivo || null;
    await aquisicao.save();

    // Libertar unidades se já tinham sido reservadas
    if (wasApproved) {
      await libertarUnidades(aquisicao.material, aquisicao.codigosUnidades, aquisicao.quantidade);
    }


    const aqPopulada = await Aquisicao.findById(aquisicao._id)
      .populate('material', 'nome icone')
      .populate('solicitante', 'nome email')
      .populate('professor', 'nome')
      .lean();

    if (aqPopulada?.solicitante?.email) {
      const motivo = aquisicao.motivoRejeicao;
      sendMail(
        aqPopulada.solicitante.email,
        `Requisição rejeitada — ${aqPopulada.material?.nome || 'Material'}`,
        emailBase(`
          <h2 style="color:#1a2a4a;margin-top:0">Requisição rejeitada</h2>
          <p>Olá <strong>${esc(aqPopulada.solicitante.nome)}</strong>, a sua requisição foi <strong>rejeitada</strong>.</p>
          ${blocoMaterial(aqPopulada)}
          <p style="background:#ffebee;border-left:4px solid #e53935;padding:12px 16px;border-radius:4px;font-size:14px;">
            ${motivo
              ? `Motivo: <strong>${esc(motivo)}</strong>`
              : 'A sua requisição foi rejeitada.'}
          </p>
          ${btnEntrar()}
        `)
      );
    }

    return res.status(200).json({ success: true, message: 'Requisição rejeitada.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.put('/:id/devolver', protect, validateObjectId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'ID inválido.' });

    const aquisicao = await Aquisicao.findById(req.params.id);
    if (!aquisicao) return res.status(404).json({ success: false, message: 'Requisição não encontrada.' });

    const podeGerir = ['admin', 'gestor'].includes(req.user.role);
    if (!podeGerir && aquisicao.solicitante.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Sem permissão para esta ação.' });
    }
    if (!['aprovado', 'em_uso', 'por_entregar'].includes(aquisicao.status)) {
      return res.status(400).json({ success: false, message: 'Esta Requisição não pode ser devolvida.' });
    }

    aquisicao.status = 'devolvido';
    aquisicao.dataDevolucao = new Date();
    await aquisicao.save();

    await libertarUnidades(aquisicao.material, aquisicao.codigosUnidades, aquisicao.quantidade);

    return res.status(200).json({ success: true, message: 'Material devolvido com sucesso.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.put('/:id', protect, validateObjectId, [
  body('quantidade').optional().isInt({ min: 1, max: 999 }).withMessage('Quantidade deve ser entre 1 e 999'),
  body('motivo').optional().trim().isLength({ min: 10, max: 500 }).withMessage('Motivo deve ter entre 10 e 500 caracteres'),
  body('dataInicio').optional().isISO8601().withMessage('Data de início inválida').toDate(),
  body('dataFim').optional().isISO8601().withMessage('Data de fim inválida').toDate(),
  body('status').optional().isIn(['aprovado', 'em_uso', 'por_entregar', 'devolvido']).withMessage('Estado inválido'),
  body('observacaoAdmin').optional().trim().isLength({ max: 500 }).withMessage('Observação deve ter no máximo 500 caracteres')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

    if (!['admin', 'gestor'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Sem permissão para editar requisições.' });
    }

    const aquisicao = await Aquisicao.findById(req.params.id);
    if (!aquisicao) return res.status(404).json({ success: false, message: 'Requisição não encontrada.' });

    const editaveis = ['aprovado', 'em_uso', 'por_entregar'];
    if (!editaveis.includes(aquisicao.status)) {
      return res.status(400).json({ success: false, message: 'Só é possível editar requisições ativas (aprovado, em uso ou por entregar).' });
    }

    const { quantidade, motivo, dataInicio, dataFim, status, observacaoAdmin } = req.body;

    const novaInicio = dataInicio ? new Date(dataInicio) : aquisicao.dataInicio;
    const novaFim    = dataFim    ? new Date(dataFim)    : aquisicao.dataFim;
    if (novaFim <= novaInicio) {
      return res.status(400).json({ success: false, message: 'Data de fim deve ser posterior à data de início.' });
    }
    const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
    if (novaFim.getTime() - novaInicio.getTime() > UMA_SEMANA_MS) {
      return res.status(400).json({ success: false, message: 'O período máximo de uma requisição é de 1 semana (7 dias).' });
    }

    if (quantidade !== undefined && quantidade !== aquisicao.quantidade) {
      const qtdAntiga      = aquisicao.quantidade;
      const codigosAntigos = aquisicao.codigosUnidades || [];

      await libertarUnidades(aquisicao.material, codigosAntigos, qtdAntiga);
      const novosCodigos = await reservarUnidades(aquisicao.material, quantidade);

      if (novosCodigos === null) {
        const reposto = await reservarUnidades(aquisicao.material, qtdAntiga);
        aquisicao.codigosUnidades = reposto || codigosAntigos;
        await aquisicao.save();
        return res.status(400).json({ success: false, message: 'Stock insuficiente para a nova quantidade.' });
      }
      aquisicao.quantidade      = quantidade;
      aquisicao.codigosUnidades = novosCodigos;
    }

    aquisicao.dataInicio = novaInicio;
    aquisicao.dataFim    = novaFim;
    if (motivo !== undefined) aquisicao.motivo = motivo;
    if (observacaoAdmin !== undefined) aquisicao.observacaoAdmin = observacaoAdmin;

    if (status && status !== aquisicao.status) {
      aquisicao.status = status;
      if (status === 'devolvido') {
        aquisicao.dataDevolucao = new Date();
        await libertarUnidades(aquisicao.material, aquisicao.codigosUnidades, aquisicao.quantidade);
      }
    }

    await aquisicao.save();

    const populada = await Aquisicao.findById(aquisicao._id)
      .populate('material', 'nome icone categoria')
      .populate('solicitante', 'nome role numero email')
      .populate('professor', 'nome')
      .populate('aprovadoPor', 'nome')
      .lean();

    if (populada?.solicitante?.email) {
      sendMail(
        populada.solicitante.email,
        `Requisição atualizada — ${populada.material?.nome || 'Material'}`,
        emailBase(`
          <h2 style="color:#1a2a4a;margin-top:0">Requisição atualizada</h2>
          <p>Olá <strong>${esc(populada.solicitante.nome)}</strong>, a sua requisição foi atualizada.</p>
          ${blocoMaterial(populada)}
          <p style="background:#e3f2fd;border-left:4px solid #2196f3;padding:12px 16px;border-radius:4px;font-size:14px;">
            Estado atual: <strong>${esc(populada.status)}</strong>.
          </p>
          ${btnEntrar()}
        `)
      );
    }

    return res.status(200).json({ success: true, message: 'Requisição atualizada com sucesso.', aquisicao: populada });
  } catch (error) {
    console.error('Edit aquisicao error:', error.message);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

router.delete('/:id', protect, validateObjectId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'ID inválido.' });

    const aquisicao = await Aquisicao.findById(req.params.id);
    if (!aquisicao) return res.status(404).json({ success: false, message: 'Requisição não encontrada.' });

    const isOwner = aquisicao.solicitante.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'Sem permissão.' });
    if (!isAdmin && aquisicao.status !== 'pendente') {
      return res.status(400).json({ success: false, message: 'Apenas pedidos pendentes podem ser cancelados.' });
    }

    const wasApproved = ['aprovado', 'em_uso', 'por_entregar'].includes(aquisicao.status);
    aquisicao.status = 'cancelado';
    await aquisicao.save();

    if (wasApproved) {
      await libertarUnidades(aquisicao.material, aquisicao.codigosUnidades, aquisicao.quantidade);
    }

    return res.status(200).json({ success: true, message: 'Requisição cancelada.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});


async function marcarExpiradasPorEntregar() {
  const agora = new Date();
  try {
    const expiradas = await Aquisicao.find({
      status: { $in: ['aprovado', 'em_uso'] },
      dataFim: { $lt: agora }
    })
      .populate('material', 'nome icone')
      .populate('solicitante', 'nome email');

    if (!expiradas.length) return;
    console.log(`[scheduler] ${expiradas.length} requisição(ões) em atraso → "por entregar"...`);

    for (const aq of expiradas) {
      try {
        await Aquisicao.findByIdAndUpdate(aq._id, { $set: { status: 'por_entregar' } });

        if (aq.solicitante?.email) {
          sendMail(
            aq.solicitante.email,
            `Material por entregar — ${aq.material?.nome || 'Material'}`,
            emailBase(`
              <h2 style="color:#1a2a4a;margin-top:0">Prazo terminado</h2>
              <p>Olá <strong>${esc(aq.solicitante.nome)}</strong>, o prazo da sua requisição terminou e o material consta como <strong>por entregar</strong>.</p>
              <p style="background:#fff4e5;border-left:4px solid #ff9800;padding:12px 16px;border-radius:4px;font-size:14px;">
                Por favor, entregue o material na sala Led.
              </p>
              ${btnEntrar()}
            `)
          );
        }
        console.log(`[scheduler] Requisição ${aq._id} marcada como "por entregar".`);
      } catch (err) {
        console.error(`[scheduler] ❌ Erro em ${aq._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[scheduler] Erro geral:', err.message);
  }
}

// Corre à meia-noite e às 05:00 (salvaguarda)
cron.schedule('0 0 * * *', marcarExpiradasPorEntregar, { timezone: 'Europe/Lisbon' });
cron.schedule('0 5 * * *', marcarExpiradasPorEntregar, { timezone: 'Europe/Lisbon' });

// Correr ao arrancar para resolver expiradas enquanto o servidor esteve offline
marcarExpiradasPorEntregar();

module.exports = router;