import { FastifyInstance } from 'fastify'
import { prisma } from '../db'

export async function dropletRoutes(fastify: FastifyInstance) {
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
          i."webhookVerificationToken",
          i."companyDropletUuid",
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
            i."webhookVerificationToken",
            i."companyDropletUuid",
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
          webhookVerificationToken: installData.webhookVerificationToken, // Include webhook verification token
          companyDropletUuid: installData.companyDropletUuid, // Include company droplet UUID
          fluidShop: installData.fluidShop, // Include the company's Fluid shop domain
          // Token availability info
          tokenInfo: {
            hasAuthToken: !!installData.authenticationToken,
            hasWebhookToken: !!installData.webhookVerificationToken,
            authTokenType: installData.authenticationToken ?
              (installData.authenticationToken.startsWith('dit_') ? 'droplet_installation_token' :
                installData.authenticationToken.startsWith('cdrtkn_') ? 'company_droplet_token' : 'unknown') : null
          }
        }
      };

      return result;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

}