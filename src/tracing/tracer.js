const { initTracer } = require('jaeger-client');

const tracer = initTracer(
  {
    serviceName: 'broker-express',
    sampler: { type: 'const', param: 1 },
    reporter: {
      logSpans: false,
      agentHost: process.env.JAEGER_HOST || 'localhost',
      agentPort: parseInt(process.env.JAEGER_PORT || '6831'),
    },
  },
  { logger: { info: () => {}, error: console.error } }
);

module.exports = tracer;
