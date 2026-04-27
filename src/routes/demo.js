const express = require('express');
const router = express.Router();
const customerRepo = require('../repositories/CustomerRepository');
const productRepo = require('../repositories/ProductRepository');
const orderService = require('../services/OrderService');
const rabbitmqBus = require('../broker/eventBus');
const store = require('../data/store');

// ── POST /api/demo/seed ────────────────────────────────────────────────────────
// Crea clientes y productos de prueba con stock suficiente para el flood
router.post('/seed', (req, res) => {
  const customers = [
    { name: 'Ana García',     email: 'ana@demo.com'    },
    { name: 'Luis Martínez',  email: 'luis@demo.com'   },
    { name: 'Carlos López',   email: 'carlos@demo.com' },
    { name: 'María Torres',   email: 'maria@demo.com'  },
    { name: 'Pedro Ramírez',  email: 'pedro@demo.com'  },
  ];

  const products = [
    { name: 'Laptop Gamer',     unitPrice: 1200, stockQuantity: 500, sku: 'LAP-001' },
    { name: 'Monitor 4K',       unitPrice: 450,  stockQuantity: 500, sku: 'MON-001' },
    { name: 'Teclado Mecánico', unitPrice: 80,   stockQuantity: 500, sku: 'TEC-001' },
  ];

  const createdCustomers = customers.map(c => customerRepo.create(c));
  const createdProducts  = products.map(p => productRepo.create(p));

  console.log('\n[Demo] ✔ Seed completado: 5 clientes y 3 productos creados.\n');

  res.status(201).json({
    message: 'Datos de demo creados. Ahora ejecuta POST /api/demo/flood',
    customers: createdCustomers,
    products: createdProducts,
  });
});

// ── POST /api/demo/flood ───────────────────────────────────────────────────────
// Encola N órdenes de golpe para visualizar el broker en RabbitMQ UI
router.post('/flood', async (req, res) => {
  const count = parseInt(req.body.count) || 20;

  const customers = customerRepo.findAll();
  const products  = productRepo.findAll();

  if (customers.length === 0 || products.length === 0) {
    return res.status(400).json({
      error: 'No hay datos. Ejecuta primero POST /api/demo/seed'
    });
  }

  console.log(`\n[Demo] Encolando ${count} órdenes...`);

  const orderIds = [];

  for (let i = 0; i < count; i++) {
    const customer = customers[i % customers.length];
    const product  = products[i % products.length];

    const result = await orderService.createOrder({
      customerEmail: customer.email,
      paymentMethod: 'CREDIT_CARD',
      items: [{ sku: product.sku, quantity: 1 }],
    });

    if (result.orderId) orderIds.push(result.orderId);
  }

  console.log(`[Demo] ✔ ${orderIds.length} órdenes publicadas en RabbitMQ.\n`);

  res.status(202).json({
    message: `${orderIds.length} órdenes encoladas. Observa las colas en http://localhost:15672`,
    total: orderIds.length,
    orderIds,
  });
});

// ── POST /api/demo/reset ───────────────────────────────────────────────────────
// Purga todas las colas de RabbitMQ y limpia la memoria — sin reiniciar Docker
router.post('/reset', async (req, res) => {
  await rabbitmqBus.purgeQueues();
  store.reset();
  console.log('\n[Demo] ✔ Reset completo: colas purgadas y memoria limpia.\n');
  res.json({
    message: 'Reset completo. Colas de RabbitMQ purgadas y datos en memoria borrados. Ejecuta /seed y luego /flood.'
  });
});

module.exports = router;
