const rabbitmqBus = require('../broker/eventBus');
const customerRepo = require('../repositories/CustomerRepository');
const productRepo = require('../repositories/ProductRepository');
const orderRepo = require('../repositories/OrderRepository');

class OrderService {
  async createOrder({ customerEmail, paymentMethod, items }) {
    const customer = customerRepo.findByEmail(customerEmail);
    if (!customer) {
      return { error: 'Cliente no existe.', status: 400 };
    }

    const normalizedItems = items.map(item => ({
      sku: item.SKU || item.sku,
      quantity: item.quantity
    }));

    for (const item of normalizedItems) {
      if (!productRepo.findBySku(item.sku)) {
        return { error: 'Uno o más productos no existen.', status: 400 };
      }
    }

    const order = orderRepo.create({ customerId: customer.id, items: normalizedItems, paymentMethod });

    await rabbitmqBus.publish('order.created', {
      orderId: order.id,
      customerId: customer.id,
      items: normalizedItems,
      paymentMethod
    });

    return { orderId: order.id };
  }

  getOrder(id) {
    const order = orderRepo.findById(id);
    if (!order) return null;

    const customer = customerRepo.findById(order.customerId);
    const enrichedItems = order.items.map(item => {
      const product = productRepo.findBySku(item.sku);
      return { sku: item.sku, name: product ? product.name : 'N/A', quantity: item.quantity };
    });

    return {
      orderId: order.id,
      status: order.status,
      customer: customer ? { name: customer.name, email: customer.email } : null,
      items: enrichedItems,
      totalAmount: order.totalAmount,
      payment: order.payment,
      invoice: order.invoice,
      failureReason: order.failureReason,
      createdAt: order.createdAt
    };
  }
}

module.exports = new OrderService();
