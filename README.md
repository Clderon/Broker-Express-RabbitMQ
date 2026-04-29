# Notas de Estudio — Message Broker (RabbitMQ)

---

## Diapositiva 1

### Notas de Discurso

1. Sobre el Desacoplamiento:

"No es solo enviar un mensaje; es romper la dependencia. El emisor no sabe dónde está el receptor ni le importa si está encendido en ese momento. Esto es lo que llamamos asincronía real."

2. Sobre la Persistencia:

"El Broker no es solo un cable; tiene memoria. Si un servicio cae, el Durable Subscriber asegura que el mensaje espere en el 'buffer' hasta que sea seguro entregarlo. Nada se pierde."

3. Sobre Smart Endpoints:

"A diferencia de un ESB, el Broker es una tubería simple (Dumb Pipe). Esto es lo que lo hace tan rápido y escalable. No pierde tiempo transformando datos; eso lo hacen las aplicaciones en los bordes."

---

## Diapositiva 2

### Notas de Discurso

1. Selective Consumer
   - En la Diapositiva: Enrutamiento Inteligente (Selective Consumer)
   - En tu mente: "Es un filtro. El Broker no envía todo a todos; lee las etiquetas del mensaje y lo entrega solo a quien realmente lo necesita."

2. Durable Subscriber
   - En la Diapositiva: Persistencia (Durable Subscriber)
   - En tu mente: "Es la memoria del Broker. Si el receptor se desconecta, el mensaje no se pierde; se queda guardado en el 'disco duro' del Broker hasta que el sistema vuelva."

3. Idempotent Receiver
   - En la Diapositiva: Cero Duplicados (Idempotent Receiver)
   - En tu mente: "Es el seguro contra errores de red. Si el Broker envía un mensaje dos veces por error, el receptor es capaz de reconocerlo y no procesarlo de nuevo para no cobrar doble o crear dos pedidos."

4. Consumer Group / Competing Consumers
   - En la Diapositiva: Escalabilidad (Consumer Groups)
   - En tu mente: "Es trabajo en equipo. En lugar de un solo trabajador procesando la fila, ponemos a tres. El Broker reparte la carga para que todo sea más rápido."

---

### Evidencia Diapositiva 1

#### 1. Desacoplamiento / Asincronía real

Prueba en código — dos lugares que lo demuestran juntos:

`src/services/OrderService.js` líneas 26–33
```js
await rabbitmqBus.publish('order.created', {   // publica y olvida
  orderId: order.id,
  ...
});
return { orderId: order.id };  // retorna SIN esperar que nadie consuma
```
OrderService no importa, no llama, no conoce a InventoryService. Solo lanza el evento al broker y se va.

`src/routes/orders.js` línea 18–22
```js
return res.status(202).json({
  message: 'Orden recibida. Procesando de forma asíncrona vía RabbitMQ.',
  status: 'Pending'
});
```
El 202 es la prueba en el protocolo HTTP: "recibí tu pedido pero no terminé de procesarlo". El cliente no espera.

---

#### 2. Persistencia — Durable Subscriber

`src/broker/eventBus.js` líneas 17 y 21 (en publish) y línea 39 (en subscribe)
```js
await this.channel.assertQueue(queue, { durable: true });  // cola sobrevive reinicio del broker
...
{ persistent: true }  // mensaje se escribe en disco, no solo en RAM
await this.channel.assertQueue(queue, { durable: true });  // el suscriptor también declara durabilidad
```
Ambos lados declaran durable: true. Si RabbitMQ se reinicia, las colas y los mensajes pendientes siguen ahí esperando.

---

#### 3. Smart Endpoints, Dumb Pipe

El broker (eventBus.js) completo — no tiene ni una línea de lógica de negocio. Solo transporta bytes:

```js
Buffer.from(JSON.stringify(payload))  // serializa sin interpretar
```

Toda la lógica vive en los extremos — comparalo con InventoryService.js líneas 15–25 donde sí está la regla de negocio (verificar stock, calcular total). El broker no sabe nada de eso.

---

### Evidencia Diapositiva 2

#### 1. Selective Consumer — Enrutamiento inteligente

Cada servicio declara exactamente a qué cola escucha y solo recibe lo que le corresponde:

| Archivo | Línea | Cola que consume |
|---|---|---|
| InventoryService.js | 10 | 'order.created' |
| InventoryService.js | 48 | 'payment.failed' (solo para compensar) |
| PaymentService.js | 10 | 'stock.reserved' |
| BillingService.js | 10 | 'payment.success' |

PaymentService nunca ve un mensaje de order.created. BillingService nunca ve stock.reserved. Cada uno recibe solo lo que necesita.

---

#### 2. Durable Subscriber — Persistencia

Ya cubierto arriba. El punto clave para la diapositiva es mostrar que son dos propiedades distintas:

- durable: true en la cola → la cola sobrevive al broker
- persistent: true en el mensaje → el contenido sobrevive al broker

eventBus.js líneas 17 y 21 — ambas deben estar presentes para garantía completa.

---

#### 3. Idempotent Receiver — Cero duplicados

`src/broker/eventBus.js` líneas 44–49
```js
await handler(payload);
this.channel.ack(msg);          // confirma: procesado, eliminar del broker
} catch (err) {
this.channel.nack(msg, false, false);  // falla: no reencolar, descartar
```

El ack es el mecanismo de confirmación: el broker retiene el mensaje hasta recibir ese ack. Si el proceso muere antes del ack, el broker lo reentrega. El segundo false en nack evita que el mensaje vuelva a la cola infinitamente si hay un error permanente.

---

#### 4. Competing Consumers — Escalabilidad

`src/broker/eventBus.js` línea 12
```js
this.channel.prefetch(1);
```

Esta es la línea más importante para explicar escalabilidad. prefetch(1) le dice al broker: "manda solo 1 mensaje por vez a este consumidor hasta que haga ack". Si levantás dos instancias de la app, el broker distribuye automáticamente — una instancia toma el mensaje 1, la otra toma el mensaje 2. Sin configuración extra, sin coordinación entre instancias.
