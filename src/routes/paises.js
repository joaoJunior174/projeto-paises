const express = require('express');
const { listarPaisesDisponiveis } = require('../services/sorteioService');

const router = express.Router();

/**
 * GET /api/paises
 * Retorna países ainda disponíveis (não excluídos e não sorteados).
 */
router.get('/', async (req, res, next) => {
  try {
    const paises = await listarPaisesDisponiveis();
    res.json({
      total: paises.length,
      paises,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
