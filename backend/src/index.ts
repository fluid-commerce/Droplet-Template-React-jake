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

// Root route
fastify.get('/', async (request, reply) => {
  return { 
    message: 'Fluid Droplet Backend API', 
    status: 'running',
    timestamp: new Date().toISOString() 
  };
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

    // Validate the authentication token format (should start with 'dit_' or 'cdrtkn_')
    if (!fluid_api_key.startsWith('dit_') && !fluid_api_key.startsWith('cdrtkn_')) {
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
fastify.post('/api/webhook/fluid', async (request, reply) => {
  try {
    const body = request.body as any;
    fastify.log.info(`Received webhook body: ${JSON.stringify(body, null, 2)}`);
    fastify.log.info(`Webhook headers: ${JSON.stringify(request.headers, null, 2)}`);

    // Handle installation events
    if (body.event === 'installed') {
      const { company } = body;
      
      fastify.log.info(`Processing installation event for: ${company.droplet_installation_uuid}`);
      
      // Create or update company
      const companyRecord = await prisma.company.upsert({
        where: { fluidId: company.fluid_company_id.toString() },
        update: {
          name: company.name,
          logoUrl: null, // Fluid doesn't provide logo in webhook
          updatedAt: new Date()
        },
        create: {
          fluidId: company.fluid_company_id.toString(),
          name: company.name,
          logoUrl: null
        }
      });

      // Create or update installation - always set to active for install events
      const installation = await prisma.installation.upsert({
        where: { fluidId: company.droplet_installation_uuid },
        update: {
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          fluidId: company.droplet_installation_uuid,
          companyId: companyRecord.id,
          isActive: true
        }
      });

      fastify.log.info(`Installation created/updated for company: ${company.name}, active: ${installation.isActive}`);
    }

    // Handle uninstallation events
    if (body.event === 'uninstalled') {
      const { company } = body;
      
      fastify.log.info(`Processing uninstallation event for: ${company.droplet_installation_uuid}`);
      
      const result = await prisma.installation.updateMany({
        where: { fluidId: company.droplet_installation_uuid },
        data: { isActive: false }
      });

      fastify.log.info(`Installation deactivated: ${company.droplet_installation_uuid}, updated: ${result.count} records`);
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
