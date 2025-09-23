import { FastifyInstance } from 'fastify'
import { OrderService } from '../services/orderService'
import { prisma } from '../db'

export async function orderRoutes(fastify: FastifyInstance) {
  // Get orders for an installation (from our database)
  fastify.get('/api/orders/:installationId', async (request, reply) => {
    try {
      const { installationId } = request.params as { installationId: string }

      // Verify installation exists and is active
      const installationResult = await prisma.$queryRaw`
        SELECT i.*, c.name as "companyName", c."logoUrl" as "companyLogoUrl", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      `
      const installation = Array.isArray(installationResult) && installationResult.length > 0
        ? installationResult[0]
        : null

      if (!installation) {
        return reply.status(404).send({
          success: false,
          message: 'Installation not found or inactive'
        })
      }

      const orders = await OrderService.getOrdersForInstallation(installation.id)

      return reply.send({
        success: true,
        data: {
          orders,
          installation: {
            id: installation.fluidId,
            companyName: installation.companyName
          }
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch orders'
      })
    }
  })

  // Sync orders from Fluid API to our database
  fastify.post('/api/orders/:installationId/sync', async (request, reply) => {
    try {
      const { installationId } = request.params as { installationId: string }

      // Get installation details
      const installationResult = await prisma.$queryRaw`
        SELECT i.*, c.name as "companyName", c."logoUrl" as "companyLogoUrl", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      `
      const installation = Array.isArray(installationResult) && installationResult.length > 0
        ? installationResult[0]
        : null

      if (!installation) {
        return reply.status(404).send({
          success: false,
          message: 'Installation not found or inactive'
        })
      }

      if (!(installation as any).authenticationToken) {
        return reply.status(400).send({
          success: false,
          message: 'No authentication token available for this installation'
        })
      }

      // Get company subdomain from stored fluidShop
      const fluidShop = (installation as any).fluidShop
      if (!fluidShop) {
        return reply.status(400).send({
          success: false,
          message: 'Company Fluid shop domain not found. Please reinstall the droplet.'
        })
      }

      // Extract subdomain (e.g., "pokey" from "pokey.fluid.app")
      const companyShop = fluidShop.replace('.fluid.app', '')

      // Sync orders from Fluid
      const syncResult = await OrderService.syncOrdersFromFluid(
        installation.id,
        companyShop,
        (installation as any).authenticationToken
      )

      return reply.send({
        success: true,
        data: {
          message: `Successfully synced ${syncResult.synced} orders from Fluid`,
          synced: syncResult.synced,
          errors: syncResult.errors,
          installation: {
            id: installation.fluidId,
            companyName: installation.companyName
          }
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to sync orders from Fluid'
      })
    }
  })



  // Test orders from Fluid API (for testing token functionality)
  fastify.get('/api/orders/:installationId/fluid', async (request, reply) => {
    try {
      const { installationId } = request.params as { installationId: string }

      // Get installation details
      const installationResult = await prisma.$queryRaw`
        SELECT i.*, c.name as "companyName", c."logoUrl" as "companyLogoUrl", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      `
      const installation = Array.isArray(installationResult) && installationResult.length > 0
        ? installationResult[0]
        : null

      if (!installation) {
        return reply.status(404).send({
          success: false,
          message: 'Installation not found or inactive'
        })
      }

      if (!(installation as any).authenticationToken) {
        return reply.status(400).send({
          success: false,
          message: 'No authentication token available for this installation'
        })
      }

      // Get company subdomain from stored fluidShop
      const fluidShop = (installation as any).fluidShop
      if (!fluidShop) {
        return reply.status(400).send({
          success: false,
          message: 'Company Fluid shop domain not found. Please reinstall the droplet.'
        })
      }

      // Extract subdomain (e.g., "pokey" from "pokey.fluid.app")
      const companyShop = fluidShop.replace('.fluid.app', '')

      // Fetch orders directly from Fluid API
      const fluidResponse = await OrderService.fetchOrdersFromFluid(
        companyShop,
        (installation as any).authenticationToken,
        1,
        5 // Limit to 5 for testing
      )

      return reply.send({
        success: true,
        data: {
          orders: fluidResponse.orders,
          meta: fluidResponse.meta,
          installation: {
            id: installation.fluidId,
            companyName: installation.companyName
          }
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch orders from Fluid API'
      })
    }
  })
}