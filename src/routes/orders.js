const express = require('express');
const router = express.Router();
const orderService = require('../services/OrderService');

router.post('/', async (req, res) => {
  const { customerEmail, paymentMethod, items } = req.body;

  if (!customerEmail || !paymentMethod || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'customerEmail, paymentMethod e items son requeridos.' });
  }

  const result = await orderService.createOrder({ customerEmail, paymentMethod, items });

  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  return res.status(202).json({
    message: 'Orden recibida. Procesando de forma asíncrona vía RabbitMQ.',
    orderId: result.orderId,
    status: 'Pending'
  });
});

router.get('/:id', (req, res) => {
  const order = orderService.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' });
  res.json(order);
});

module.exports = router;
