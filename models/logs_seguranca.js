const mongoose = require('mongoose');

const logSegurancaSchema = new mongoose.Schema({
  evento: {
    type: String,
    required: [true, 'Evento é obrigatório'],
    enum: {
      values: [
        'login_sucesso',
        'login_falhado',
        'logout',
        'conta_bloqueada',
        'conta_desbloqueada',
        'password_alterada',
        'requisicao_criada',
        'requisicao_aprovada',
        'requisicao_rejeitada',
        'requisicao_cancelada',
        'requisicao_devolvida'
      ],
      message: 'Evento inválido'
    }
  },
  severidade: {
    type: String,
    enum: {
      values: ['info', 'aviso', 'erro', 'critico'],
      message: 'Severidade inválida'
    },
    default: 'info'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  emailTentativa: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [150, 'Email muito longo'],
    default: null
  },
  recurso: {
    tipo: {
      type: String,
      enum: {
        values: ['Requisições', 'Material', 'User', null],
        message: 'Tipo de recurso inválido'
      },
      default: null
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    }
  },
  ip: {
    type: String,
    required: [true, 'IP é obrigatório'],
    trim: true,
    maxlength: [45, 'IP demasiado longo'],
    // Aceita IPv4, IPv6 e IPv4-mapeado-em-IPv6 (ex.: ::ffff:127.0.0.1)
    // Validação leve: só verifica que são caracteres plausíveis de IP.
    match: [/^[0-9a-fA-F:.]+$/, 'Formato de IP inválido']
  },
  userAgent: {
    type: String,
    trim: true,
    maxlength: [500, 'User-Agent muito longo'],
    default: null
  },
  quando: {
    type: Date,
    default: Date.now,
    required: true
  },
  motivo: {
    type: String,
    required: [true, 'Motivo é obrigatório'],
    trim: true,
    minlength: [3, 'Motivo demasiado curto'],
    maxlength: [500, 'Motivo demasiado longo']
  },
  detalhes: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  strict: true,
  versionKey: false
});

logSegurancaSchema.index({ evento: 1, quando: -1 });
logSegurancaSchema.index({ user: 1, quando: -1 });
logSegurancaSchema.index({ ip: 1, quando: -1 });
logSegurancaSchema.index({ severidade: 1, quando: -1 });

// TTL — expira automaticamente 90 dias após `quando`
logSegurancaSchema.index({ quando: 1 }, { expireAfterSeconds: 7776000 });

// Normaliza IP: tira o prefixo IPv6 ::ffff: dos IPv4 mapeados
// e troca ::1 (loopback IPv6) por 127.0.0.1 para ficar legível.
function normalizarIP(ip) {
  if (!ip) return '0.0.0.0';
  ip = String(ip).trim();
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

// Helper estático: nunca lança, falhar a registar log não pode partir o pedido.
logSegurancaSchema.statics.registar = async function(dados) {
  try {
    return await this.create(dados);
  } catch (err) {
    console.error('[LogSeguranca] Falha ao registar evento:', err.message);
    return null;
  }
};

// Helper que aceita o `req` do Express e extrai IP/User-Agent automaticamente.
logSegurancaSchema.statics.registarReq = function(req, dados) {
  const ipBruto = dados.ip
    || req.ip
    || req.connection?.remoteAddress
    || '0.0.0.0';

  return this.registar({
    ...dados,
    ip: normalizarIP(ipBruto),
    userAgent: dados.userAgent || req.get?.('user-agent') || null
  });
};

module.exports = mongoose.model('LogSeguranca', logSegurancaSchema, 'Logs_Seguranca');