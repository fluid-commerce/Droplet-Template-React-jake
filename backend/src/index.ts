import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { prisma } from './db';
import { randomUUID } from 'crypto';
import { productRoutes } from './routes/products';

const fastify = Fastify({
  logger: { level: 'warn' }
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
    
    
    let installation = await prisma.installation.findUnique({
      where: { fluidId: installationId },
      include: { company: true }
    });

    // Fallback: if not found, get the most recent active installation
    if (!installation) {
      fastify.log.warn(`Installation not found: ${installationId}, trying fallback...`);
      installation = await prisma.installation.findFirst({
        where: { isActive: true },
        include: { company: true },
        orderBy: { updatedAt: 'desc' }
      });

      if (installation) {
        // fallback found; info logs removed
      }
    }

    if (!installation) {
      fastify.log.warn(`No active installations found for: ${installationId}`);
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
    let installation = await prisma.installation.findUnique({
      where: { fluidId: installationId },
      include: { company: true }
    });

    // Fallback: if not found, get the most recent active installation
    if (!installation) {
      fastify.log.warn(`Installation not found for brand guidelines: ${installationId}, trying fallback...`);
      installation = await prisma.installation.findFirst({
        where: { isActive: true },
        include: { company: true },
        orderBy: { updatedAt: 'desc' }
      });

      if (installation) {
        fastify.log.info(`✅ Found fallback installation for brand guidelines: ${installation.fluidId}`);
      }
    }

    if (!installation) {
      fastify.log.warn(`No active installations found for brand guidelines: ${installationId}`);
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

      // info logs removed

      const response = await fetch(fluidApiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${fluid_api_key}`,
          'Content-Type': 'application/json'
        }
      });

      // info logs removed

      if (!response.ok) {
        const errorText = await response.text();
        fastify.log.warn(`Fluid API error response: ${errorText}`);
        throw new Error(`Fluid API error: ${response.status} - ${errorText}`);
      }

      const brandData = await response.json();
      // info logs removed

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
        tokenType: 'dit_',
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

    // First try to find the exact installation ID
    let installation = await prisma.$queryRaw`
      SELECT
        i.id,
        i."fluidId",
        i."isActive",
        i."authenticationToken",
        i."companyApiKey",
        c.name as "companyName",
        c."logoUrl",
        c."fluidShop"
      FROM installations i
      JOIN companies c ON i."companyId" = c.id
      WHERE i."fluidId" = ${installationId} AND i."isActive" = true
    ` as any[];

    // If not found, try to find the most recent active installation for any company
    // This handles cases where the frontend has an old installation ID
    if (!installation || installation.length === 0) {
      fastify.log.warn(`Installation not found: ${installationId}, trying fallback search...`);

      installation = await prisma.$queryRaw`
        SELECT
          i.id,
          i."fluidId",
          i."isActive",
          i."authenticationToken",
          i."companyApiKey",
          c.name as "companyName",
          c."logoUrl",
          c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."isActive" = true
        ORDER BY i."updatedAt" DESC
        LIMIT 1
      ` as any[];

      if (installation && installation.length > 0) {
        // fallback found; info logs removed
      }
    }

    if (!installation || installation.length === 0) {
      fastify.log.warn(`No active installations found for: ${installationId}`);
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
        authenticationToken: installData.authenticationToken, // Include the dit_ token
        companyApiKey: installData.companyApiKey, // Include the company API key
        fluidShop: installData.fluidShop // Include the company's Fluid shop domain
      }
    };

    return result;
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// Save company API key for installation
fastify.post('/api/droplet/company-api-key/:installationId', async (request, reply) => {
  try {
    const { installationId } = request.params as { installationId: string }
    const { companyApiKey } = request.body as { companyApiKey: string }

    if (!companyApiKey || !companyApiKey.trim()) {
      return reply.status(400).send({
        success: false,
        message: 'Company API key is required'
      })
    }

    // Update the installation with the company API key
    const updateResult = await prisma.$executeRaw`
      UPDATE installations
      SET "companyApiKey" = ${companyApiKey.trim()}, "updatedAt" = NOW()
      WHERE "fluidId" = ${installationId}
    `

    if (updateResult === 0) {
      return reply.status(404).send({
        success: false,
        message: 'Installation not found'
      })
    }

    return reply.send({
      success: true,
      message: 'Company API key saved successfully'
    })
  } catch (error) {
    fastify.log.error(error)
    return reply.status(500).send({
      success: false,
      message: 'Failed to save company API key'
    })
  }
})

// Webhook endpoint for Fluid platform events
fastify.post('/api/webhook/fluid', async (request, reply) => {
  try {
    const body = request.body as any;

    // info logs removed

    // Handle installation events
    if (body.event === 'installed') {
      const { company } = body;

      // info logs removed

      if (company.authentication_token?.startsWith('dit_')) {
        fastify.log.info('✅ Received dit_ token from Fluid webhook - this is the correct token type for droplet installations');
      }


      // Create or update company using raw SQL to handle the new fluid_shop column
      const companyRecord = await prisma.$queryRaw`
        INSERT INTO companies (id, "fluidId", name, "logoUrl", "fluidShop", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${company.fluid_company_id.toString()}, ${company.name}, null, ${company.fluid_shop}, NOW(), NOW())
        ON CONFLICT ("fluidId")
        DO UPDATE SET
          name = EXCLUDED.name,
          "fluidShop" = EXCLUDED."fluidShop",
          "updatedAt" = NOW()
        RETURNING id, "fluidId", name, "fluidShop"
      ` as any[];

      const companyData = companyRecord[0];

      // Get the company API token (cdrtkn_) by calling the droplet installation endpoint
      // According to Fluid docs: we need to call /api/droplet_installations/{uuid} to get cdrtkn_ token
      let companyApiToken = company.authentication_token; // fallback to dit_ token

      try {
        // Extract subdomain from fluid_shop (e.g., "myco" from "myco.fluid.app")
        const subdomain = company.fluid_shop ? company.fluid_shop.replace('.fluid.app', '') : null;

        if (subdomain && company.droplet_installation_uuid) {
          // Use the correct API pattern from Fluid documentation
          const installationEndpoint = `https://${subdomain}.fluid.app/api/droplet_installations/${company.droplet_installation_uuid}`;

          fastify.log.info(`🔍 Fetching cdrtkn_ token from: ${installationEndpoint}`);

          const installationResponse = await fetch(installationEndpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${company.authentication_token}`,
              'Content-Type': 'application/json'
            }
          });

          if (installationResponse.ok) {
            const installationData = await installationResponse.json();
            fastify.log.info(`✅ Got installation data from Fluid API`);

            // Extract the authentication token from the response
            // The response structure is: { droplet_installation: { authentication_token: "..." } }
            const authToken = installationData.droplet_installation?.authentication_token || installationData.authentication_token;

            if (authToken) {
              companyApiToken = authToken;
              if (authToken.startsWith('dit_')) {
                fastify.log.info(`✅ Successfully obtained dit_ token: ${authToken.substring(0, 15)}...`);
                fastify.log.info(`📝 dit_ tokens are the correct format for droplet installations`);
              } else if (authToken.startsWith('cdrtkn_')) {
                fastify.log.info(`✅ Got cdrtkn_ token from Fluid API: ${authToken.substring(0, 15)}...`);
              } else {
                fastify.log.warn(`⚠️ Unknown token format: ${authToken.substring(0, 10)}...`);
              }
            } else {
              fastify.log.warn(`⚠️ No authentication token found in installation response`);
              fastify.log.warn(`Raw installation response: ${JSON.stringify(installationData, null, 2)}`);
            }
          } else {
            const errorText = await installationResponse.text();
            fastify.log.error(`❌ Failed to fetch installation: ${installationResponse.status} - ${errorText}`);
          }
        } else {
          fastify.log.warn(`⚠️ Missing subdomain or installation UUID - cannot fetch cdrtkn_ token`);
        }
      } catch (error) {
        fastify.log.error(`Error fetching company API token: ${error}`);
      }

      // Create or update installation using raw SQL to handle the new column
      await prisma.$queryRaw`
        INSERT INTO installations (id, "companyId", "fluidId", "authenticationToken", "isActive", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${companyData.id}, ${company.droplet_installation_uuid}, ${companyApiToken}, true, NOW(), NOW())
        ON CONFLICT ("fluidId")
        DO UPDATE SET
          "isActive" = true,
          "authenticationToken" = ${companyApiToken},
          "updatedAt" = NOW()
        RETURNING id, "fluidId", "isActive", "authenticationToken"
      ` as any[];

      // info logs removed

    }

    // Handle uninstallation events
    if (body.event === 'uninstalled') {
      const { company } = body;
      
      
      // Deactivate the installation using the correct database schema
      await prisma.$queryRaw`
        UPDATE installations
        SET "isActive" = false, "updatedAt" = NOW()
        WHERE "fluidId" = ${company.droplet_installation_uuid}
        RETURNING "fluidId"
      `;

      // info logs removed

    }

    return { status: 'ok' };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Webhook processing failed' });
  }
});

// Register product routes
fastify.register(productRoutes);

// Start the server
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    // startup info log removed
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
