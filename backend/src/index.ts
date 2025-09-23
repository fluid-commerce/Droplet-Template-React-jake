import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { prisma } from './db';
import { randomUUID } from 'crypto';

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


// Get installation details including authentication token (for Fluid integration)
fastify.get('/api/droplet/installation/:installationId', async (request, reply) => {
  try {
    const { installationId } = request.params as { installationId: string };
    
    
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

    return result;
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// Get brand guidelines for an installation
fastify.get('/api/droplet/brand-guidelines/:installationId', async (request, reply) => {
  try {
    const { installationId } = request.params as { installationId: string };
    const { fluid_api_key } = request.query as { fluid_api_key: string };


    if (!fluid_api_key) {
      fastify.log.warn('Brand guidelines request missing fluid_api_key');
      return reply.status(400).send({ error: 'Fluid API key required' });
    }

    // Validate the authentication token format
    if (!fluid_api_key.startsWith('dit_') && !fluid_api_key.startsWith('cdrtkn_')) {
      fastify.log.warn(`Invalid API key format: ${fluid_api_key.substring(0, 10)}...`);
      return reply.status(400).send({ error: 'Invalid authentication token format' });
    }

    // Find the installation
    const installation = await prisma.installation.findUnique({
      where: { fluidId: installationId },
      include: { company: true }
    });

    if (!installation) {
      fastify.log.warn(`Installation not found for brand guidelines: ${installationId}`);
      return reply.status(404).send({ error: 'Installation not found' });
    }

    if (!installation.isActive) {
      fastify.log.warn(`Installation inactive for brand guidelines: ${installationId}`);
      return reply.status(403).send({ error: 'Installation is inactive' });
    }

    try {
      // Fetch brand guidelines from Fluid API
      // Note: We don't store the fluid_shop in our database, so we'll use the main Fluid API
      const fluidApiUrl = `https://fluid.app/api/settings/brand_guidelines`;

      const response = await fetch(fluidApiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${fluid_api_key}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        fastify.log.warn(`Fluid API returned ${response.status}: ${response.statusText}`);
        throw new Error(`Fluid API error: ${response.status}`);
      }

      const brandData = await response.json();

      const result = {
        data: {
          name: brandData.name || installation.company.name,
          logo_url: brandData.logo_url || installation.company.logoUrl,
          color: brandData.color || '#2563eb',
          secondary_color: brandData.secondary_color || '#1d4ed8',
          icon_url: brandData.icon_url,
          favicon_url: brandData.favicon_url
        }
      };

      return result;
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      fastify.log.warn(`Failed to fetch brand guidelines from Fluid API: ${errorMessage}`);
      
      // Fallback to basic company information
      const brandGuidelines = {
        name: installation.company.name,
        logo_url: installation.company.logoUrl,
        color: '#2563eb', // Default blue fallback
        secondary_color: '#1d4ed8'
      };

      const result = {
        data: brandGuidelines
      };

      return result;
    }
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// Get company authentication token for API operations
fastify.get('/api/droplet/auth-token/:installationId', async (request, reply) => {
  try {
    const { installationId } = request.params as { installationId: string };
    const { fluid_api_key } = request.query as { fluid_api_key: string };


    if (!fluid_api_key) {
      fastify.log.warn('Auth token request missing fluid_api_key');
      return reply.status(400).send({ error: 'Fluid API key required' });
    }

    // Validate the authentication token format
    if (!fluid_api_key.startsWith('dit_') && !fluid_api_key.startsWith('cdrtkn_')) {
      fastify.log.warn(`Invalid API key format: ${fluid_api_key.substring(0, 10)}...`);
      return reply.status(400).send({ error: 'Invalid authentication token format' });
    }

    // Find the installation using the correct database schema
    const installation = await prisma.$queryRaw`
      SELECT 
        i.id,
        i."fluidId",
        i."isActive",
        i."authenticationToken",
        c.name as "companyName"
      FROM installations i
      JOIN companies c ON i."companyId" = c.id
      WHERE i."fluidId" = ${installationId}
    ` as any[];

    if (!installation || installation.length === 0) {
      fastify.log.warn(`Installation not found for auth token: ${installationId}`);
      return reply.status(404).send({ error: 'Installation not found' });
    }

    const installData = installation[0];

    if (!installData.isActive) {
      fastify.log.warn(`Installation inactive for auth token: ${installationId}`);
      return reply.status(403).send({ error: 'Installation is inactive' });
    }

    if (!installData.authenticationToken) {
      fastify.log.warn(`No authentication token found for installation: ${installationId}`);
      return reply.status(404).send({ error: 'Authentication token not available' });
    }

    const result = {
      data: {
        installationId: installData.fluidId,
        companyName: installData.companyName,
        authenticationToken: installData.authenticationToken,
        tokenType: 'cdrtkn_',
        usage: 'Use this token to authenticate API calls on behalf of the company'
      }
    };

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

      // If API key is provided, validate it
      if (fluid_api_key) {
        // Validate the authentication token format (should start with 'dit_' or 'cdrtkn_')
        if (!fluid_api_key.startsWith('dit_') && !fluid_api_key.startsWith('cdrtkn_')) {
          fastify.log.warn(`Invalid API key format: ${fluid_api_key.substring(0, 10)}...`);
          return reply.status(400).send({ error: 'Invalid authentication token format' });
        }
      }

    // Find the installation using the correct database schema
    const installation = await prisma.$queryRaw`
      SELECT 
        i.id,
        i."fluidId",
        i."isActive",
        i."authenticationToken",
        c.name as "companyName",
        c."logoUrl"
      FROM installations i
      JOIN companies c ON i."companyId" = c.id
      WHERE i."fluidId" = ${installationId}
    ` as any[];


    if (!installation || installation.length === 0) {
      fastify.log.warn(`Installation not found: ${installationId}`);
      return reply.status(404).send({ error: 'Installation not found' });
    }

    const installData = installation[0];

    if (!installData.isActive) {
      fastify.log.warn(`Installation inactive: ${installationId}`);
      return reply.status(403).send({ error: 'Installation is inactive' });
    }

    const result = {
      data: {
        companyName: installData.companyName,
        logoUrl: installData.logoUrl,
        installationId: installData.fluidId,
        authenticationToken: installData.authenticationToken // Include the cdrtkn_ token
      }
    };

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

    // Handle installation events
    if (body.event === 'installed') {
      const { company } = body;
      
      
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

      // Create or update installation using raw SQL to handle the new column
      const installation = await prisma.$queryRaw`
        INSERT INTO installations (id, "companyId", "fluidId", "authenticationToken", "isActive", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${companyRecord.id}, ${company.droplet_installation_uuid}, ${company.authentication_token}, true, NOW(), NOW())
        ON CONFLICT ("fluidId") 
        DO UPDATE SET 
          "isActive" = true,
          "authenticationToken" = ${company.authentication_token},
          "updatedAt" = NOW()
        RETURNING id, "fluidId", "isActive", "authenticationToken"
      ` as any[];

      const installData = installation[0];

    }

    // Handle uninstallation events
    if (body.event === 'uninstalled') {
      const { company } = body;
      
      
      // Deactivate the installation using the correct database schema
      const result = await prisma.$queryRaw`
        UPDATE installations 
        SET "isActive" = false, "updatedAt" = NOW()
        WHERE "fluidId" = ${company.droplet_installation_uuid}
        RETURNING "fluidId"
      ` as any[];

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
