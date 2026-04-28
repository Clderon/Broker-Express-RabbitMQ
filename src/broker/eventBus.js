const amqp = require('amqplib');

// Exchange nombrado: hace visible la topología en RabbitMQ Management / CloudAMQP Visualizer.
// Con sendToQueue() los mensajes van al exchange por defecto (anónimo) y el visualizador
// no puede construir el grafo Exchange → Binding → Queue.
const EXCHANGE = 'broker.events';

class RabbitMQBus {
  constructor() {
    this.channel = null;
    this.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }

  async connect() {
    const connection = await amqp.connect(this.RABBITMQ_URL);
    this.channel = await connection.createChannel();
    this.channel.prefetch(1);
    // Declarar el exchange una sola vez al conectar
    await this.channel.assertExchange(EXCHANGE, 'direct', { durable: true });
    console.log('[RabbitMQ] ✔ Conexión establecida →', this.RABBITMQ_URL);
    console.log(`[RabbitMQ] Exchange declarado: "${EXCHANGE}" (direct, durable)`);
  }

  async publish(queue, payload) {
    await this.channel.assertQueue(queue, { durable: true });
    // bindQueue es idempotente: llamarlo varias veces con los mismos parámetros es seguro
    await this.channel.bindQueue(queue, EXCHANGE, queue);
    this.channel.publish(
      EXCHANGE,
      queue,   // routing key = nombre de la cola
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );
    console.log(`\n[Broker] ► Publicado → Exchange: "${EXCHANGE}" | Routing key: "${queue}"`);
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
    await this.channel.bindQueue(queue, EXCHANGE, queue);
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
    console.log(`[RabbitMQ] Suscrito → Exchange: "${EXCHANGE}" | Queue: "${queue}"`);
  }
}

const rabbitmqBus = new RabbitMQBus();
module.exports = rabbitmqBus;
