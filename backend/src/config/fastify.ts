import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

export function createFastifyInstance() {
  const fastify = Fastify({
    logger: { level: 'info' }
  });

  // Register plugins
  fastify.register(helmet);

  // Improved CORS configuration for production
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://fluid.app',
    'https://*.fluid.app',
    'https://droplet-frontend-go5d.onrender.com',
    'https://droplet-backend-go5d.onrender.com',
    process.env.FRONTEND_URL
  ].filter(Boolean);

  fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list or matches wildcard patterns
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed === origin) return true;
        if (allowed?.includes('*')) {
          const pattern = allowed.replace('*', '.*');
          return new RegExp(pattern).test(origin);
        }
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        fastify.log.warn(`CORS blocked origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true
  });

  return fastify;
}