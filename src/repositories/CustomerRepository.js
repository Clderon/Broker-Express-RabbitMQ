const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');

class CustomerRepository {
  create({ name, email, isActive = true }) {
    const customer = { id: uuidv4(), name, email, isActive };
    store.customers.push(customer);
    return customer;
  }

  findAll() {
    return store.customers;
  }

  findById(id) {
    return store.customers.find(c => c.id === id) || null;
  }

  findByEmail(email) {
    return store.customers.find(c => c.email === email) || null;
  }
}

module.exports = new CustomerRepository();
