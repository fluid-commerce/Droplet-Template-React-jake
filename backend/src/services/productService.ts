import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface FluidProduct {
  id: number
  title: string
  sku?: string
  description?: string
  image_url?: string
  status?: string
  price?: string
  in_stock?: boolean
  public?: boolean
}

export interface FluidProductsResponse {
  products: FluidProduct[]
  meta: {
    request_id: string
    timestamp: string
    pagination?: {
      page: number
      per_page: number
      total_pages: number
      total_count: number
    }
  }
}

export class ProductService {
  /**
   * Fetch products from Fluid API
   */
  static async fetchProductsFromFluid(
    companyShop: string,
    authToken: string,
    page: number = 1,
    perPage: number = 50
  ): Promise<FluidProductsResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      status: 'active' // Only fetch active products
    })

    const response = await fetch(
      `https://${companyShop}.fluid.app/api/company/v1/products?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch products from Fluid: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Sync products from Fluid to our database
   */
  static async syncProductsFromFluid(
    installationId: string,
    companyShop: string,
    authToken: string
  ): Promise<{ synced: number; errors: number }> {
    try {
      // Fetch all products from Fluid (with pagination)
      let page = 1
      let hasMorePages = true
      let syncedCount = 0
      let errorCount = 0

      while (hasMorePages) {
        const fluidResponse = await this.fetchProductsFromFluid(companyShop, authToken, page, 50)
        
        // Process each product
        for (const fluidProduct of fluidResponse.products) {
          try {
            await prisma.product.upsert({
              where: {
                installationId_fluidProductId: {
                  installationId,
                  fluidProductId: fluidProduct.id.toString()
                }
              },
              update: {
                title: fluidProduct.title,
                sku: fluidProduct.sku || null,
                description: fluidProduct.description || null,
                imageUrl: fluidProduct.image_url || null,
                status: fluidProduct.status || null,
                price: fluidProduct.price || null,
                inStock: fluidProduct.in_stock ?? true,
                public: fluidProduct.public ?? true,
                updatedAt: new Date()
              },
              create: {
                installationId,
                fluidProductId: fluidProduct.id.toString(),
                title: fluidProduct.title,
                sku: fluidProduct.sku || null,
                description: fluidProduct.description || null,
                imageUrl: fluidProduct.image_url || null,
                status: fluidProduct.status || null,
                price: fluidProduct.price || null,
                inStock: fluidProduct.in_stock ?? true,
                public: fluidProduct.public ?? true
              }
            })
            syncedCount++
          } catch (error) {
            console.error(`Error syncing product ${fluidProduct.id}:`, error)
            errorCount++
          }
        }

        // Check if there are more pages
        if (fluidResponse.meta.pagination) {
          hasMorePages = page < fluidResponse.meta.pagination.total_pages
          page++
        } else {
          hasMorePages = false
        }
      }

      return { synced: syncedCount, errors: errorCount }
    } catch (error) {
      console.error('Error syncing products from Fluid:', error)
      throw error
    }
  }

  /**
   * Get products from our database for an installation
   */
  static async getProductsForInstallation(installationId: string) {
    return await prisma.product.findMany({
      where: {
        installationId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })
  }

  /**
   * Get a single product by Fluid ID
   */
  static async getProductByFluidId(installationId: string, fluidProductId: string) {
    return await prisma.product.findUnique({
      where: {
        installationId_fluidProductId: {
          installationId,
          fluidProductId
        }
      }
    })
  }
}
