const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    minlength: [2, 'Nome deve ter no mínimo 2 caracteres'],
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres'],
    // Sanitize: only allow letters, spaces, hyphens, apostrophes
    match: [/^[a-zA-ZÀ-ÿ\s\-']+$/, 'Nome contém caracteres inválidos']
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/, 'Email inválido'],
    maxlength: [150, 'Email muito longo']
  },
  password: {
    type: String,
    required: [true, 'Password é obrigatória'],
    minlength: [8, 'Password deve ter no mínimo 8 caracteres'],
    select: false 
  },
  role: {
    type: String,
    enum: {
      values: ['aluno', 'professor', 'gestor', 'admin'],
      message: 'Role inválido'
    },
    default: 'aluno'
  },
  escola: {
    type: String,
    required: [true, 'Escola é obrigatória'],
    enum: {
      values: ['rainha', 'eugenio'],
      message: 'Escola inválida'
    }
  },
  numero: {
    type: String,
    trim: true,
    maxlength: [20, 'Número muito longo'],
    match: [/^[a-zA-Z0-9\-]*$/, 'Número contém caracteres inválidos']
  },
  ativo: {
    type: Boolean,
    default: false   // começa falso para confirmar que é um aluno real do agrupamento por parte de administração
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  lockUntil: {
    type: Date,
    select: false
  },
}, {
  strict: true,
  versionKey: false
});

userSchema.index({ role: 1 });
userSchema.index({ escola: 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, rounds);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!candidatePassword || typeof candidatePassword !== 'string') return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incLoginAttempts = async function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 };
  }
  return this.updateOne(updates);
};

userSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id,
    nome: this.nome,
    email: this.email,
    role: this.role,
    escola: this.escola,
    numero: this.numero,
    ativo: this.ativo,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin
  };
};

module.exports = mongoose.model('User', userSchema); // se quiseres mudar o nome do model tambem vao precisar de mudar os nomes no material auth