import { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { randomUUID } from 'crypto'

export async function webhookRoutes(fastify: FastifyInstance) {
  // Webhook endpoint for Fluid platform events
  fastify.post('/api/webhook/fluid', async (request, reply) => {
    try {
      const body = request.body as any;

      // LOG EVERYTHING - Full webhook payload analysis
      fastify.log.info('🔍 === FULL WEBHOOK PAYLOAD ANALYSIS ===');
      fastify.log.info(`📦 Full body: ${JSON.stringify(body, null, 2)}`);
      fastify.log.info(`📋 Headers: ${JSON.stringify(request.headers, null, 2)}`);
      fastify.log.info(`🎯 Event type: ${body.event}`);
      fastify.log.info(`📝 Resource: ${body.resource}`);

      // Handle order webhooks - automatically save to database
      const isOrderWebhook = body.resource === 'order' ||
        ['created', 'completed', 'updated', 'shipped', 'cancelled', 'refunded'].includes(body.event);

      if (isOrderWebhook) {
        fastify.log.info('🛒 === ORDER WEBHOOK DETECTED ===');
        fastify.log.info(`📋 Order event: ${body.event}`);
        fastify.log.info(`📋 Event identifier: ${body.event_identifier || 'N/A'}`);
        fastify.log.info(`📋 Resource: ${body.resource}`);

        if (body.order) {
          fastify.log.info(`📦 Order data: ${JSON.stringify(body.order, null, 2)}`);
          fastify.log.info(`💰 Order total: ${body.order.total || body.order.amount || 'N/A'}`);
          fastify.log.info(`📧 Customer: ${body.order.customer_email || body.order.customer?.email || 'N/A'}`);
          fastify.log.info(`🏷️ Order tags: ${JSON.stringify(body.order.tags || [])}`);

          // Try to save order to database automatically
          try {
            // Find the installation for this order based on company info or headers
            const fluidShop = request.headers['x-fluid-shop'] as string;

            if (fluidShop) {
              fastify.log.info(`🏪 Found fluid shop header: ${fluidShop}`);

              // Find installation by fluid shop
              const installationResult = await prisma.$queryRaw`
                SELECT i.id as "installationId", i."fluidId", c.name as "companyName"
                FROM installations i
                JOIN companies c ON i."companyId" = c.id
                WHERE c."fluidShop" = ${fluidShop} AND i."isActive" = true
                LIMIT 1
              ` as any[];

              if (installationResult && installationResult.length > 0) {
                const installation = installationResult[0];

                // Prepare order data for database
                const customerEmail = body.order.customer_email || body.order.customer?.email || null;
                const customerName = body.order.customer?.name ||
                  (body.order.customer_first_name && body.order.customer_last_name
                    ? `${body.order.customer_first_name} ${body.order.customer_last_name}`
                    : body.order.customer_first_name || body.order.customer_last_name || null);

                // Insert or update order in database
                await prisma.$executeRaw`
                  INSERT INTO orders (
                    id, "installationId", "fluidOrderId", "orderNumber", amount, status,
                    "customerEmail", "customerName", "itemsCount", "orderData", "createdAt", "updatedAt"
                  ) VALUES (
                    gen_random_uuid(), ${installation.installationId}, ${body.order.id.toString()},
                    ${body.order.order_number || body.order.number || null},
                    ${body.order.total || body.order.amount || null},
                    ${body.order.status || body.order.order_status || null},
                    ${customerEmail}, ${customerName},
                    ${body.order.items_count || body.order.line_items?.length || null}::integer,
                    ${JSON.stringify(body.order)}::jsonb, NOW(), NOW()
                  )
                  ON CONFLICT ("installationId", "fluidOrderId")
                  DO UPDATE SET
                    "orderNumber" = EXCLUDED."orderNumber",
                    amount = EXCLUDED.amount,
                    status = EXCLUDED.status,
                    "customerEmail" = EXCLUDED."customerEmail",
                    "customerName" = EXCLUDED."customerName",
                    "itemsCount" = EXCLUDED."itemsCount",
                    "orderData" = EXCLUDED."orderData",
                    "updatedAt" = NOW()
                `;

                fastify.log.info(`✅ Order ${body.order.id} automatically saved to database for ${installation.companyName}`);
              } else {
                fastify.log.warn(`⚠️ No installation found for fluid shop: ${fluidShop}`);
              }
            } else {
              fastify.log.warn(`⚠️ No x-fluid-shop header found in webhook`);
            }
          } catch (dbError) {
            fastify.log.error(`❌ Failed to save order webhook to database: ${dbError}`);
          }
        }
      }

      // Check for authentication headers and verify webhook authenticity
      const authHeader = request.headers['auth-token'] || request.headers['x-auth-token'] || request.headers['authorization'];
      if (authHeader) {
        fastify.log.info(`🔐 Auth header found: ${typeof authHeader === 'string' ? authHeader.substring(0, 20) + '...' : authHeader}`);

        // TODO: Verify webhook auth_token against stored webhook configuration
        // For now, we log it for debugging but don't block processing
        fastify.log.info(`🔒 Webhook authentication detected - consider adding verification for production`);
      }

      // Handle installation events
      if (body.event === 'installed') {
        const { company } = body;

        // Log ALL company fields available
        fastify.log.info('🏢 === COMPANY DATA ANALYSIS ===');
        fastify.log.info(`🔑 All company keys: ${Object.keys(company || {}).join(', ')}`);
        fastify.log.info(`📊 Company data: ${JSON.stringify(company, null, 2)}`);

        // Check for all possible token fields
        const tokenFields = [
          'authentication_token',
          'webhook_verification_token',
          'company_droplet_uuid',
          'droplet_installation_uuid',
          'access_token',
          'api_token',
          'droplet_token'
        ];

        tokenFields.forEach(field => {
          if (company && company[field]) {
            fastify.log.info(`🎟️ Found ${field}: ${company[field].substring(0, 15)}...`);
          }
        });

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

        // Capture additional tokens if available
        const webhookVerificationToken = company.webhook_verification_token || null;
        const companyDropletUuid = company.company_droplet_uuid || null;

        // Log what we're capturing
        fastify.log.info('💾 === STORING INSTALLATION DATA ===');
        fastify.log.info(`🏢 Company ID: ${companyData.id}`);
        fastify.log.info(`🆔 Installation ID: ${company.droplet_installation_uuid}`);
        fastify.log.info(`🎟️ Auth Token: ${companyApiToken ? companyApiToken.substring(0, 15) + '...' : 'None'}`);
        fastify.log.info(`🔐 Webhook Token: ${webhookVerificationToken ? webhookVerificationToken.substring(0, 15) + '...' : 'None'}`);
        fastify.log.info(`🎯 Company Droplet UUID: ${companyDropletUuid || 'None'}`);

        // Create or update installation using raw SQL to handle all new columns
        await prisma.$queryRaw`
          INSERT INTO installations (
            id, "companyId", "fluidId", "authenticationToken",
            "webhookVerificationToken", "companyDropletUuid", "isActive", "createdAt", "updatedAt"
          )
          VALUES (
            ${randomUUID()}, ${companyData.id}, ${company.droplet_installation_uuid}, ${companyApiToken},
            ${webhookVerificationToken}, ${companyDropletUuid}, true, NOW(), NOW()
          )
          ON CONFLICT ("fluidId")
          DO UPDATE SET
            "isActive" = true,
            "authenticationToken" = ${companyApiToken},
            "webhookVerificationToken" = ${webhookVerificationToken},
            "companyDropletUuid" = ${companyDropletUuid},
            "updatedAt" = NOW()
          RETURNING id, "fluidId", "isActive", "authenticationToken", "webhookVerificationToken", "companyDropletUuid"
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
}