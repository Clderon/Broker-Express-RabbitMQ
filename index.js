const app = require('./src/server');
const rabbitmqBus = require('./src/broker/eventBus');

const PORT = process.env.PORT || 3200;

async function start() {
  await rabbitmqBus.connect();

  await require('./src/services/InventoryService').init();
  await require('./src/services/PaymentService').init();
  await require('./src/services/BillingService').init();

  app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════════════════╗`);
    console.log(`║  Broker-Express-RabbitMQ → http://localhost:${PORT}         ║`);
    console.log(`║  Patrón: Broker / Coreografía                            ║`);
    console.log(`║  RabbitMQ UI  →  http://localhost:15672                  ║`);
    console.log(`╚══════════════════════════════════════════════════════════╝\n`);
  });
}

start().catch(err => {
  console.error('[ERROR] No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});
