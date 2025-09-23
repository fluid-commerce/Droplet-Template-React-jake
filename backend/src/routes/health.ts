import { FastifyInstance } from 'fastify'

export async function healthRoutes(fastify: FastifyInstance) {
  // Root route
  fastify.get('/', async () => {
    return {
      message: 'Fluid Droplet Backend API',
      status: 'running',
      timestamp: new Date().toISOString()
    };
  });

  // Health check route
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}