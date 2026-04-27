const amqp = require('amqplib');

class RabbitMQBus {
  constructor() {
    this.channel = null;
    this.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }

  async connect() {
    const connection = await amqp.connect(this.RABBITMQ_URL);
    this.channel = await connection.createChannel();
    this.channel.prefetch(1);
    console.log('[RabbitMQ] ✔ Conexión establecida →', this.RABBITMQ_URL);
  }

  async publish(queue, payload) {
    await this.channel.assertQueue(queue, { durable: true });
    this.channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );
    console.log(`\n[Broker] ► Mensaje publicado en cola: ${queue}`);
  }

  async purgeQueues() {
    const queues = [
      'order.created', 'stock.reserved', 'stock.failed',
      'payment.success', 'payment.failed', 'order.completed'
    ];
    for (const q of queues) {
      await this.channel.assertQueue(q, { durable: true });
      await this.channel.purgeQueue(q);
    }
    console.log('[RabbitMQ] ✔ Todas las colas purgadas.');
  }

  async subscribe(queue, handler) {
    await this.channel.assertQueue(queue, { durable: true });
    this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      const payload = JSON.parse(msg.content.toString());
      try {
        await handler(payload);
        this.channel.ack(msg);
      } catch (err) {
        console.error(`[RabbitMQ] Error en cola "${queue}":`, err.message);
        this.channel.nack(msg, false, false);
      }
    });
    console.log(`[RabbitMQ] Suscrito a cola: ${queue}`);
  }
}

const rabbitmqBus = new RabbitMQBus();
module.exports = rabbitmqBus;
