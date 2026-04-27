const rabbitmqBus = require('../broker/eventBus');
const orderRepo = require('../repositories/OrderRepository');
const sleep = require('../utils/sleep');

const BILLING_DELAY_MS = 3000;
let invoiceCounter = 1;

async function init() {
  // ── Escucha: payment.success ────────────────────────────────────────────────
  await rabbitmqBus.subscribe('payment.success', async (payload) => {
    console.log(`[BillingService] Procesando payment.success... (simulando ${BILLING_DELAY_MS / 1000}s de generación en ERP)`);
    await sleep(BILLING_DELAY_MS);
    const { orderId, amount } = payload;

    const invoice = {
      invoiceNumber: `INV-${String(invoiceCounter++).padStart(6, '0')}`,
      amount,
      issuedAt: new Date().toISOString()
    };

    orderRepo.update(orderId, { status: 'Completed', invoice });

    await rabbitmqBus.publish('order.completed', {
      orderId,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: amount
    });

    console.log(`[BillingService] ✔ Orden ${orderId} COMPLETADA. Factura: ${invoice.invoiceNumber}`);
  });
}

module.exports = { init };
