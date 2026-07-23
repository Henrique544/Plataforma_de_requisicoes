const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, 'Nome do material é obrigatório'],
    trim: true,
    minlength: [2, 'Nome deve ter no mínimo 2 caracteres'],
    maxlength: [200, 'Nome deve ter no máximo 200 caracteres']
  },
  descricao: {
    type: String,
    trim: true,
    maxlength: [1000, 'Descrição muito longa']
  },
  categoria: {
    type: String,
    required: [true, 'Categoria é obrigatória'],
    enum: {
      values: [
        'Multimédia', 
        'STEM', 
        'Programação e Robótica',
        'Outros'
      ],
      message: 'Categoria inválida'
    }
  },
  escola: {
    type: String,
    required: [true, 'Escola é obrigatória'],
    enum: {
      values: ['rainha', 'eugenio'],
      message: 'Escola inválida'
    }
  },
  quantidade: {
    type: Number,
    required: [true, 'Quantidade é obrigatória'],
    min: [1, 'Quantidade não pode ser negativa'],
    max: [990, 'Quantidade muito elevada'],
    validate: {
      validator: Number.isInteger,
      message: 'Quantidade deve ser um número inteiro'
    }
  },
  quantidadeDisponivel: {
    type: Number,
    min: [0, 'Quantidade disponível não pode ser negativa'],
    default: function() { return this.quantidade; }
  },
  // Unidades físicas individuais, cada uma com o seu código (ex.: Mfb01, Mfb02).
  // É a partir daqui que se atribuem códigos ao aprovar uma requisição.
  unidades: {
    type: [{
      _id: false,
      codigo: {
        type: String,
        required: true,
        trim: true,
        maxlength: [60, 'Código de unidade inválido']
      },
      status: {
        type: String,
        enum: ['disponivel', 'requisitado'],
        default: 'disponivel'
      }
    }],
    default: []
  },
  icone: {
    type: String,
    default: '📦',
    maxlength: [10, 'Ícone inválido']
  },
  status: {
    type: String,
    enum: ['disponivel', 'indisponivel', 'manutencao'],
    default: 'disponivel'
  },
  criadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ativo: {
    type: Boolean,
    default: true
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

materialSchema.index({ nome: 'text', descricao: 'text' });
materialSchema.index({ categoria: 1 });
materialSchema.index({ status: 1 });
materialSchema.index({ escola: 1 });
materialSchema.index({ escola: 1, categoria: 1 });

materialSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Material', materialSchema);  // se quiseres mudar o nome do model tambem vão precisar de mudar os nomes no auth.