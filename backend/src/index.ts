import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { prisma } from './db';

const fastify = Fastify({
  logger: true
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

// Debug endpoint to list installations (for troubleshooting)
fastify.get('/api/debug/installations', async (request, reply) => {
  try {
    const installations = await prisma.installation.findMany({
      include: { company: true },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });
    
    return {
      count: installations.length,
      installations: installations.map(inst => ({
        id: inst.fluidId,
        company: inst.company.name,
        active: inst.isActive,
        created: inst.createdAt,
        updated: inst.updatedAt
      }))
    };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// Get installation details including authentication token (for Fluid integration)
fastify.get('/api/droplet/installation/:installationId', async (request, reply) => {
  try {
    const { installationId } = request.params as { installationId: string };
    
    fastify.log.info(`Installation details request for: ${installationId}`);
    
    const installation = await prisma.installation.findUnique({
      where: { fluidId: installationId },
      include: { company: true }
    });

    if (!installation) {
      fastify.log.warn(`Installation not found: ${installationId}`);
      return reply.status(404).send({ error: 'Installation not found' });
    }

    if (!installation.isActive) {
      fastify.log.warn(`Installation inactive: ${installationId}`);
      return reply.status(403).send({ error: 'Installation is inactive' });
    }

    const result = {
      data: {
        companyName: installation.company.name,
        logoUrl: installation.company.logoUrl,
        installationId: installation.fluidId,
        isActive: installation.isActive
      }
    };

    fastify.log.info(`Returning installation details for: ${installation.company.name}`);
    return result;
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// Get company dashboard data
fastify.get('/api/droplet/dashboard/:installationId', async (request, reply) => {
  try {
    const { installationId } = request.params as { installationId: string };
    const { fluid_api_key } = request.query as { fluid_api_key: string };

    fastify.log.info(`Dashboard request for installation: ${installationId}, API key: ${fluid_api_key?.substring(0, 10)}...`);

    if (!fluid_api_key) {
      fastify.log.warn('Dashboard request missing fluid_api_key');
      return reply.status(400).send({ error: 'Fluid API key required' });
    }

    // Validate the authentication token format (should start with 'dit_' or 'cdrtkn_')
    if (!fluid_api_key.startsWith('dit_') && !fluid_api_key.startsWith('cdrtkn_')) {
      fastify.log.warn(`Invalid API key format: ${fluid_api_key.substring(0, 10)}...`);
      return reply.status(400).send({ error: 'Invalid authentication token format' });
    }

    // Find the installation and company
    const installation = await prisma.installation.findUnique({
      where: { fluidId: installationId },
      include: { company: true }
    });

    fastify.log.info(`Installation lookup result: ${installation ? 'found' : 'not found'}`);
    if (installation) {
      fastify.log.info(`Installation active: ${installation.isActive}, company: ${installation.company.name}`);
    }

    if (!installation) {
      fastify.log.warn(`Installation not found: ${installationId}`);
      return reply.status(404).send({ error: 'Installation not found' });
    }

    if (!installation.isActive) {
      fastify.log.warn(`Installation inactive: ${installationId}`);
      return reply.status(403).send({ error: 'Installation is inactive' });
    }

    const result = {
      data: {
        companyName: installation.company.name,
        logoUrl: installation.company.logoUrl,
        installationId: installation.fluidId
      }
    };

    fastify.log.info(`Returning dashboard data for: ${installation.company.name}`);
    return result;
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
