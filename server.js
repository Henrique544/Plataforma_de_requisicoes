require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');

const connectDB = require('./config/db');
const {
  apiLimiter, helmetConfig, noSQLSanitize,
  xssSanitize, sanitizeBody, preventParamPollution, securityHeaders
} = require('./middleware/security');

require('./models/logs_seguranca');

connectDB();

const app = express();

app.set('trust proxy', 1);

app.use(helmetConfig);
app.use(securityHeaders);
app.use(compression());

app.use(express.json({ limit: '10kb' }));    
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use(noSQLSanitize);
app.use(xssSanitize);
app.use(sanitizeBody);
app.use(preventParamPollution);

app.use('/api/', apiLimiter);

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/aquisicoes', require('./routes/aquisicoes'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  const message = process.env.NODE_ENV === 'production' 
    ? 'Erro interno do servidor.' 
    : err.message;
  res.status(err.status || 500).json({ success: false, message });
});


process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
  console.log(`Escola Requisicoes - ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;