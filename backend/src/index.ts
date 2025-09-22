import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { prisma } from './db';

const fastify = Fastify({
  logger: true
});

// Register plugins
fastify.register(helmet);
fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
});

// Health check route
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Get company dashboard data
fastify.get('/api/droplet/dashboard/:installationId', async (request, reply) => {
  try {
    const { installationId } = request.params as { installationId: string };
    const { fluid_api_key } = request.query as { fluid_api_key: string };

    if (!fluid_api_key) {
      return reply.status(400).send({ error: 'Fluid API key required' });
    }

    // Validate the authentication token format (should start with 'cdrtkn_')
    if (!fluid_api_key.startsWith('cdrtkn_')) {
      return reply.status(400).send({ error: 'Invalid authentication token format' });
    }

    // Find the installation and company
    const installation = await prisma.installation.findUnique({
      where: { fluidId: installationId },
      include: { company: true }
    });

    if (!installation) {
      return reply.status(404).send({ error: 'Installation not found' });
    }

    if (!installation.isActive) {
      return reply.status(403).send({ error: 'Installation is inactive' });
    }

    return {
      data: {
        companyName: installation.company.name,
        logoUrl: installation.company.logoUrl,
        installationId: installation.fluidId
      }
    };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// Webhook endpoint for Fluid platform events
fastify.post('/api/webhooks/fluid', async (request, reply) => {
  try {
    const body = request.body as any;
    fastify.log.info('Received webhook:', body);

    // Handle installation events
    if (body.event === 'installation.created') {
      const { company, installation } = body.data;
      
      // Create or update company
      const companyRecord = await prisma.company.upsert({
        where: { fluidId: company.id },
        update: {
          name: company.name,
          logoUrl: company.logo_url,
          updatedAt: new Date()
        },
        create: {
          fluidId: company.id,
          name: company.name,
          logoUrl: company.logo_url
        }
      });

      // Create installation
      await prisma.installation.upsert({
        where: { fluidId: installation.id },
        update: {
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          fluidId: installation.id,
          companyId: companyRecord.id,
          isActive: true
        }
      });

      fastify.log.info(`Installation created for company: ${company.name}`);
    }

    // Handle uninstallation events
    if (body.event === 'installation.deleted') {
      const { installation } = body.data;
      
      await prisma.installation.update({
        where: { fluidId: installation.id },
        data: { isActive: false }
      });

      fastify.log.info(`Installation deactivated: ${installation.id}`);
    }

    return { status: 'ok' };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Webhook processing failed' });
  }
});

// Start the server
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server is running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
