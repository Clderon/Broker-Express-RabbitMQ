const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');

class OrderRepository {
  create({ customerId, items, paymentMethod }) {
    const order = {
      id: uuidv4(),
      customerId,
      items,
      paymentMethod,
      status: 'Pending',
      totalAmount: null,
      payment: null,
      invoice: null,
      failureReason: null,
      createdAt: new Date().toISOString()
    };
    store.orders.push(order);
    return order;
  }

  findById(id) {
    return store.orders.find(o => o.id === id) || null;
  }

  update(id, fields) {
    const order = this.findById(id);
    if (!order) return null;
    Object.assign(order, fields);
    return order;
  }
}

module.exports = new OrderRepository();
