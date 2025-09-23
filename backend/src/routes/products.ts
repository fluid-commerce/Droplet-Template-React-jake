import { FastifyInstance } from 'fastify'
import { ProductService } from '../services/productService'
import { prisma } from '../db'

export async function productRoutes(fastify: FastifyInstance) {
  // Simple in-memory cache for product images to avoid repeated API calls
  const imageCache = new Map<string, { url: string | null; cachedAt: number }>()
  const IMAGE_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

  // Get products for an installation (from our database)
  fastify.get('/api/products/:installationId', async (request, reply) => {
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

      const products = await ProductService.getProductsForInstallation(installation.id)

      return reply.send({
        success: true,
        data: {
          products,
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
        message: 'Failed to fetch products'
      })
    }
  })

  // Get product image by product ID
  fastify.get('/api/products/:installationId/image/:productId', async (request, reply) => {
    try {
      const { installationId, productId } = request.params as { installationId: string, productId: string }

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

      // Check cache first
      const cacheKey = `${installationId}_${productId}`
      const cached = imageCache.get(cacheKey)
      if (cached && (Date.now() - cached.cachedAt) < IMAGE_CACHE_TTL_MS) {
        return reply.send({
          success: true,
          data: { imageUrl: cached.url }
        })
      }

      // Fetch product image from Fluid API on cache miss
      try {
        // Ensure we pass the subdomain (e.g., "tacobell") not the full domain
        const fluidShop = (installation as any).fluidShop
        const companyShop = fluidShop?.replace?.('.fluid.app', '') || fluidShop

        // Use company API key if available, fallback to dit token
        const tokenToUse = (installation as any).companyApiKey || (installation as any).authenticationToken

        const imageUrl = await ProductService.fetchProductImages(
          companyShop,
          tokenToUse,
          parseInt(productId)
        )

        // Cache the result (even if null)
        imageCache.set(cacheKey, { url: imageUrl, cachedAt: Date.now() })

        return reply.send({
          success: true,
          data: { imageUrl }
        })
      } catch (imageError) {
        // Cache null result to prevent repeated failed requests
        imageCache.set(cacheKey, { url: null, cachedAt: Date.now() })

        return reply.send({
          success: true,
          data: { imageUrl: null }
        })
      }
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch product image'
      })
    }
  })

  // Sync products from Fluid API to our database
  fastify.post('/api/products/:installationId/sync', async (request, reply) => {
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

      // Sync products from Fluid
      const syncResult = await ProductService.syncProductsFromFluid(
        installation.id,
        companyShop,
        (installation as any).authenticationToken,
        (installation as any).companyApiKey
      )

      return reply.send({
        success: true,
        data: {
          message: `Successfully synced ${syncResult.synced} products from Fluid`,
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
        message: 'Failed to sync products from Fluid'
      })
    }
  })

  // Test products from Fluid API (for testing token functionality)
  fastify.get('/api/products/:installationId/fluid', async (request, reply) => {
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

      // Use company API key if available, fallback to dit token
      const tokenToUse = (installation as any).companyApiKey || (installation as any).authenticationToken

      // Fetch products directly from Fluid API
      const fluidResponse = await ProductService.fetchProductsFromFluid(
        companyShop,
        tokenToUse,
        1,
        10 // Limit to 10 for testing
      )

      return reply.send({
        success: true,
        data: {
          products: fluidResponse.products,
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
        message: 'Failed to fetch products from Fluid API'
      })
    }
  })
}