import express, { type Express } from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import router from './routes';
import { logger } from './lib/logger';

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    customProps(req) {
      const correlationId = req.headers['x-correlation-id'] ?? req.id;
      return {
        correlationId,
        idempotencyKey: req.headers['idempotency-key'],
      };
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split('?')[0],
          correlationId: req.headers['x-correlation-id'] ?? req.id,
          idempotencyKey: req.headers['idempotency-key'],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const header = req.headers['x-correlation-id'];
  const correlationId = Array.isArray(header) ? header[0] : header;
  res.setHeader('x-correlation-id', correlationId || String(req.id));
  next();
});

app.use('/api', router);

export default app;
