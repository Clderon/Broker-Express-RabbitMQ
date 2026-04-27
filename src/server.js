const express = require('express');
const app = express();

app.use(express.json());

app.use('/api/customers', require('./routes/customers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/demo', require('./routes/demo'));

module.exports = app;
