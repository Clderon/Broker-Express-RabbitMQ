const rabbitmqBus = require('../broker/eventBus');
const productRepo = require('../repositories/ProductRepository');
const orderRepo = require('../repositories/OrderRepository');
const sleep = require('../utils/sleep');

const INVENTORY_DELAY_MS = 4000;

async function init() {
  // ── Escucha: order.created ──────────────────────────────────────────────────
  await rabbitmqBus.subscribe('order.created', async (payload, span) => {
    console.log(`[InventoryService] Procesando order.created... (simulando ${INVENTORY_DELAY_MS / 1000}s de consulta a inventario)`);
    await sleep(INVENTORY_DELAY_MS);
    const { orderId, items, paymentMethod, customerId } = payload;

    for (const item of items) {
      const product = productRepo.findBySku(item.sku);
      if (!product || product.stockQuantity < item.quantity) {
        const reason = !product
          ? `Producto SKU ${item.sku} no existe (datos reiniciados).`
          : `Stock insuficiente para SKU ${item.sku}.`;
        orderRepo.update(orderId, { status: 'Failed', failureReason: reason });
        await rabbitmqBus.publish('stock.failed', { orderId, reason }, span);
        return;
      }
    }

    let totalAmount = 0;
    const reservedItems = items.map(item => {
      const product = productRepo.findBySku(item.sku);
      product.stockQuantity -= item.quantity;
      totalAmount += product.unitPrice * item.quantity;
      return { sku: item.sku, quantity: item.quantity, unitPrice: product.unitPrice };
    });

    orderRepo.update(orderId, { status: 'StockReserved', totalAmount });
    console.log(`[InventoryService] Stock reservado. Total: $${totalAmount}`);

    await rabbitmqBus.publish('stock.reserved', {
      orderId,
      customerId,
      items: reservedItems,
      totalAmount,
      paymentMethod
    }, span);
  });

  // ── Compensación: revertir stock si el pago falla ──────────────────────────
  await rabbitmqBus.subscribe('payment.failed', async (payload, span) => {
    console.log('[InventoryService] Compensación: revirtiendo stock...');
    const { items } = payload;
    if (items) {
      items.forEach(item => {
        const product = productRepo.findBySku(item.sku);
        if (product) {
          product.stockQuantity += item.quantity;
          console.log(`[InventoryService] Stock revertido para ${item.sku}: +${item.quantity}`);
        }
      });
    }
  });
}

module.exports = { init };
