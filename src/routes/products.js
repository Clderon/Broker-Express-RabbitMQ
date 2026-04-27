const express = require('express');
const router = express.Router();
const productRepo = require('../repositories/ProductRepository');

router.post('/', (req, res) => {
  const { name, unitPrice, stockQuantity, sku } = req.body;
  if (!name || unitPrice === undefined) {
    return res.status(400).json({ error: 'name y unitPrice son requeridos.' });
  }
  const product = productRepo.create({ name, unitPrice, stockQuantity, sku });
  res.status(201).json(product);
});

router.get('/', (req, res) => {
  res.json(productRepo.findAll());
});

router.patch('/:id/stock', (req, res) => {
  const { stockQuantity } = req.body;
  if (stockQuantity === undefined) {
    return res.status(400).json({ error: 'stockQuantity es requerido.' });
  }
  const product = productRepo.updateStock(req.params.id, stockQuantity);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json(product);
});

module.exports = router;
