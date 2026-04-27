const express = require('express');
const router = express.Router();
const customerRepo = require('../repositories/CustomerRepository');

router.post('/', (req, res) => {
  const { name, email, isActive } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name y email son requeridos.' });
  }
  const customer = customerRepo.create({ name, email, isActive });
  res.status(201).json(customer);
});

router.get('/', (req, res) => {
  res.json(customerRepo.findAll());
});

module.exports = router;
