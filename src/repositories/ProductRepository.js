const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');

const skuCounters = {};

function generateSku(name) {
  const prefix = name.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  skuCounters[prefix] = (skuCounters[prefix] || 0) + 1;
  return `${prefix}-${String(skuCounters[prefix]).padStart(3, '0')}`;
}

class ProductRepository {
  create({ name, unitPrice, stockQuantity = 0, sku }) {
    const product = {
      id: uuidv4(),
      sku: sku || generateSku(name),
      name,
      unitPrice,
      stockQuantity
    };
    store.products.push(product);
    return product;
  }

  findAll() {
    return store.products;
  }

  findById(id) {
    return store.products.find(p => p.id === id) || null;
  }

  findBySku(sku) {
    return store.products.find(p => p.sku === sku) || null;
  }

  updateStock(id, stockQuantity) {
    const product = this.findById(id);
    if (!product) return null;
    product.stockQuantity = stockQuantity;
    return product;
  }
}

module.exports = new ProductRepository();
