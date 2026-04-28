const { v4: uuidv4 } = require('uuid');
const rabbitmqBus = require('../broker/eventBus');
const orderRepo = require('../repositories/OrderRepository');
const sleep = require('../utils/sleep');

const PAYMENT_DELAY_MS = 6000;

async function init() {
  // ── Escucha: stock.reserved ─────────────────────────────────────────────────
  await rabbitmqBus.subscribe('stock.reserved', async (payload, span) => {
    console.log(`[PaymentService] Procesando stock.reserved... (simulando ${PAYMENT_DELAY_MS / 1000}s de respuesta de pasarela de pago)`);
    await sleep(PAYMENT_DELAY_MS);
    const { orderId, items, totalAmount, paymentMethod, customerId } = payload;

    if (paymentMethod === 'DECLINE' || totalAmount > 5000) {
      orderRepo.update(orderId, {
        status: 'Failed',
        failureReason: 'Pago rechazado.'
      });
      await rabbitmqBus.publish('payment.failed', { orderId, items, reason: 'Pago rechazado.' }, span);
      return;
    }

    const payment = {
      paymentId: uuidv4(),
      method: paymentMethod,
      amount: totalAmount,
      processedAt: new Date().toISOString()
    };

    orderRepo.update(orderId, { status: 'PaymentProcessed', payment });
    console.log(`[PaymentService] Pago aprobado. Monto: $${totalAmount}`);

    await rabbitmqBus.publish('payment.success', {
      orderId,
      customerId,
      paymentId: payment.paymentId,
      amount: totalAmount
    }, span);
  });
}

module.exports = { init };
