const amqp = require('amqplib');
const opentracing = require('opentracing');
const tracer = require('../tracing/tracer');

// Exchange nombrado: hace visible la topología en RabbitMQ Management.
// Con sendToQueue() los mensajes van al exchange anónimo y no hay grafo visible.
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
    await this.channel.assertExchange(EXCHANGE, 'direct', { durable: true });
    console.log('[RabbitMQ] ✔ Conexión establecida →', this.RABBITMQ_URL);
    console.log(`[RabbitMQ] Exchange declarado: "${EXCHANGE}" (direct, durable)`);
  }

  async publish(queue, payload, parentSpan = null) {
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, EXCHANGE, queue);

    // Crear span hijo del padre (o span raíz si no hay padre)
    const span = tracer.startSpan(`publish:${queue}`, parentSpan ? { childOf: parentSpan } : {});
    span.setTag('messaging.destination', queue);
    span.setTag('messaging.system', 'rabbitmq');

    // Inyectar el contexto del span en los headers del mensaje
    const headers = {};
    tracer.inject(span.context(), opentracing.FORMAT_TEXT_MAP, headers);

    this.channel.publish(
      EXCHANGE,
      queue,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, headers }
    );

    span.finish();
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

      // Extraer el contexto del span desde los headers del mensaje
      const headers = msg.properties.headers || {};
      const parentContext = tracer.extract(opentracing.FORMAT_TEXT_MAP, headers);
      const span = tracer.startSpan(
        `consume:${queue}`,
        parentContext ? { childOf: parentContext } : {}
      );
      span.setTag('messaging.source', queue);
      span.setTag('messaging.system', 'rabbitmq');

      try {
        // El handler recibe el payload y el span para continuar la cadena de trazas
        await handler(payload, span);
        span.finish();
        this.channel.ack(msg);
      } catch (err) {
        span.setTag(opentracing.Tags.ERROR, true);
        span.log({ event: 'error', message: err.message });
        span.finish();
        console.error(`[RabbitMQ] Error en cola "${queue}":`, err.message);
        this.channel.nack(msg, false, false);
      }
    });

    console.log(`[RabbitMQ] Suscrito → Exchange: "${EXCHANGE}" | Queue: "${queue}"`);
  }
}

const rabbitmqBus = new RabbitMQBus();
module.exports = rabbitmqBus;
