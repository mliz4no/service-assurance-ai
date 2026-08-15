import express, { type ErrorRequestHandler, type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import router from './routes';
import { logger } from './lib/logger';

const app: Express = express();
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
  throw new Error('CORS_ALLOWED_ORIGINS is required in production.');
}

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

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
app.use(helmet());
app.use(
  cors({
    origin: isProduction ? allowedOrigins : true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-API-Key', 'X-Correlation-ID'],
  }),
);
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT ?? '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT ?? '1mb' }));
app.use((req, res, next) => {
  const header = req.headers['x-correlation-id'];
  const correlationId = Array.isArray(header) ? header[0] : header;
  res.setHeader('x-correlation-id', correlationId || String(req.id));
  next();
});

app.use(
  '/api/auth/login',
  rateLimit({
    windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
    limit: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 10),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too Many Requests', message: 'Too many login attempts. Try again later.' },
  }),
);
app.use('/api', router);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'Route not found' });
});

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  req.log.error({ error }, 'Unhandled request error');
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    correlationId: res.getHeader('x-correlation-id'),
  });
};

app.use(errorHandler);

export default app;
