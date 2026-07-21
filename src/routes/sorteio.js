const express = require('express');
const { realizarSorteio } = require('../services/sorteioService');

const router = express.Router();

/**
 * POST /api/sorteio
 * Body: { "email": "nome@empresa.com" }
 * Sorteia dois países e salva no banco.
 */
router.post('/', async (req, res, next) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        erro: 'Informe o e-mail no campo "email".',
      });
    }

    const resultado = await realizarSorteio(email);

    res.status(201).json({
      mensagem: 'Sorteio realizado com sucesso.',
      ...resultado,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
