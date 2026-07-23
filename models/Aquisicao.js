const mongoose = require('mongoose');

const aquisicaoSchema = new mongoose.Schema({
  material: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: [true, 'Material é obrigatório']
  },
  solicitante: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Solicitante é obrigatório']
  },
  professor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Professor responsável é obrigatório']
  },
  quantidade: {
    type: Number,
    required: [true, 'Quantidade é obrigatória'],
    min: [1, 'Quantidade mínima é 1'],
    max: [999, 'Quantidade máxima é 999'],
    validate: {
      validator: Number.isInteger,
      message: 'Quantidade deve ser inteira'
    }
  },
  // Códigos das unidades reservadas para esta requisição (preenchido na aprovação).
  // Ex.: ['Mfb01', 'Mfb02']. Vazio em materiais sem unidades específicas.
  codigosUnidades: {
    type: [String],
    default: []
  },
  motivo: {
    type: String,
    required: [true, 'Motivo é obrigatório'],
    trim: true,
    minlength: [10, 'Motivo deve ter no mínimo 10 caracteres'],
    maxlength: [500, 'Motivo deve ter no máximo 500 caracteres']
  },
  dataInicio: {
    type: Date,
    required: [true, 'Data de início é obrigatória']
  },
  dataFim: {
    type: Date,
    required: [true, 'Data de fim é obrigatória'],
    validate: {
      validator: function(v) {
        return v > this.dataInicio;
      },
      message: 'Data de fim deve ser posterior à data de início'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['pendente', 'aprovado', 'em_uso', 'por_entregar', 'devolvido', 'rejeitado', 'cancelado'],
      message: 'Status inválido'
    },
    default: 'pendente'
  },
  // apenas para o aluno
  requerAprovacao: {
    type: Boolean,
    default: false
  },
  aprovadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  dataAprovacao: {
    type: Date,
    default: null
  },
  motivoRejeicao: {
    type: String,
    trim: true,
    maxlength: [500, 'Motivo de rejeição muito longo'],
    default: null
  },
  observacaoAdmin: {
    type: String,
    trim: true,
    maxlength: [500, 'Observação deve ter no máximo 500 caracteres'],
    default: ''
  },
  dataDevolucao: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  strict: true,
  versionKey: false
});

aquisicaoSchema.index({ material: 1 });
aquisicaoSchema.index({ solicitante: 1 });
aquisicaoSchema.index({ professor: 1 });
aquisicaoSchema.index({ status: 1 });
aquisicaoSchema.index({ dataFim: 1 });

aquisicaoSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Requisições', aquisicaoSchema , 'Requisições');