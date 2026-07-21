require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const paisesRoutes = require('./routes/paises');
const sorteioRoutes = require('./routes/sorteio');

const app = express();

// Aceita requisições vindas de qualquer origem (acesso por IP local/público)
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);

app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/paises', paisesRoutes);
app.use('/api/sorteio', sorteioRoutes);

app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error(err);
  res.status(status).json({
    erro: err.message || 'Erro interno do servidor.',
  });
});

module.exports = app;
