const store = {
  customers: [],
  products: [],
  orders: []
};

store.reset = function () {
  store.customers.length = 0;
  store.products.length  = 0;
  store.orders.length    = 0;
};

module.exports = store;
