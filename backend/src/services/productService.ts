import { prisma } from '../db'

export interface FluidProduct {
  id: number
  title: string
  sku?: string
  description?: string
  image_url?: string
  imageUrl?: string
  image?: string
  images?: any[]
  status?: string
  price?: string
  in_stock?: boolean
  public?: boolean
  [key: string]: any // Allow for additional fields from Fluid API
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

export interface FluidOrder {
  id: number
  order_number?: string
  amount?: string
  status?: string
  created_at?: string
  customer?: {
    email?: string
    first_name?: string
    last_name?: string
    name?: string
  }
  items_count?: number
  [key: string]: any // Allow for additional fields from Fluid API
}

export interface FluidOrdersResponse {
  orders: FluidOrder[]
  meta: {
    request_id: string
    timestamp: string
    current_page?: number
    total_count?: number
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

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      // Try multiple API endpoints to find the correct one
      const possibleEndpoints = [
        `https://${companyShop}.fluid.app/api/company/v1/products?${queryParams}`, // Original
        `https://app.nexui.com/api/company/v1/products?company=${companyShop}&${queryParams}`, // New API base from dashboard
        `https://app.nexui.com/api/companies/${companyShop}/products?${queryParams}`, // Alternative structure
        `https://api.fluid.app/api/company/v1/products?company=${companyShop}&${queryParams}` // Global API fallback
      ];

      let response = null;

      for (const endpoint of possibleEndpoints) {

        try {
          response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });

          if (response.ok) {
            break;
          } else {
          }
        } catch (endpointError: any) {
        }
      }

      if (!response || !response.ok) {
        throw new Error(`All product API endpoints failed. Last status: ${response?.status || 'No response'}`);
      }

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Failed to fetch products from Fluid: ${response.status} ${response.statusText}`)
      }

      const raw = await response.json()

      // Normalize possible response shapes:
      // 1) { products: [...], meta: {...} }
      // 2) { status: 'success', data: { products: [...], meta?: {...} } }
      // 3) Flat list, rare fallback
      const products = raw?.products || raw?.data?.products || []
      const meta = raw?.meta || raw?.data?.meta || raw?.data || raw

      return { products, meta }
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Fluid API took too long to respond')
      }
      throw error
    }
  }

  /**
   * Fetch product images from Fluid API
   */
  static async fetchProductImages(
    companyShop: string,
    authToken: string,
    productId: number
  ): Promise<string | null> {
    try {
      const possibleEndpoints = [
        `https://${companyShop}.fluid.app/api/company/v1/products/${productId}/images`,
        `https://app.nexui.com/api/company/v1/products/${productId}/images?company=${companyShop}`,
        `https://api.fluid.app/api/company/v1/products/${productId}/images?company=${companyShop}`
      ]
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout for images

      let imageUrl: string | null = null
      for (const endpoint of possibleEndpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          })
          if (!response.ok) continue

          const data = await response.json()
          // Normalize shapes: { images: [...] } or { status: 'success', data: { images: [...] } }
          const images = data?.images || data?.data?.images || []
          if (Array.isArray(images) && images.length > 0) {
            const sortedImages = images.sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
            imageUrl = sortedImages[0]?.image_url || sortedImages[0]?.url || null
            if (imageUrl) break
          }
        } catch (e) {
          // try next endpoint
        }
      }

      clearTimeout(timeoutId)
      return imageUrl
    } catch (error: any) {
      // If there's any error fetching images, just return null
      return null
    }
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
            
            // Prefer image fields present on the product payload to avoid extra calls
            let imageUrl = (
              fluidProduct.image_url ||
              fluidProduct.imageUrl ||
              fluidProduct.image ||
              (Array.isArray(fluidProduct.images) && fluidProduct.images.length > 0
                ? (fluidProduct.images[0]?.image_url || fluidProduct.images[0]?.url || null)
                : null)
            ) as string | null

            // Fallback: fetch images from images endpoint only if not present
            if (!imageUrl) {
              imageUrl = await ProductService.fetchProductImages(companyShop, authToken, fluidProduct.id)
            }
            

            await prisma.$executeRaw`
              INSERT INTO products (
                id, "installationId", "fluidProductId", title, sku, description, 
                "imageUrl", status, price, "inStock", public, "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), ${installationId}, ${fluidProduct.id.toString()}, 
                ${fluidProduct.title}, ${fluidProduct.sku || null}, ${fluidProduct.description || null},
                ${imageUrl}, ${fluidProduct.status || null}, 
                ${fluidProduct.price || null}, ${fluidProduct.in_stock ?? true}, 
                ${fluidProduct.public ?? true}, NOW(), NOW()
              )
              ON CONFLICT ("installationId", "fluidProductId") 
              DO UPDATE SET
                title = EXCLUDED.title,
                sku = EXCLUDED.sku,
                description = EXCLUDED.description,
                "imageUrl" = EXCLUDED."imageUrl",
                status = EXCLUDED.status,
                price = EXCLUDED.price,
                "inStock" = EXCLUDED."inStock",
                public = EXCLUDED.public,
                "updatedAt" = NOW()
            `
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
    const products = await prisma.$queryRaw`
      SELECT * FROM products 
      WHERE "installationId" = ${installationId}
      ORDER BY "updatedAt" DESC
    `
    
    
    return products
  }

  /**
   * Get a single product by Fluid ID
   */
  static async getProductByFluidId(installationId: string, fluidProductId: string) {
    const result = await prisma.$queryRaw`
      SELECT * FROM products
      WHERE "installationId" = ${installationId} AND "fluidProductId" = ${fluidProductId}
      LIMIT 1
    `
    return Array.isArray(result) && result.length > 0 ? result[0] : null
  }

  /**
   * Sync orders from Fluid to our database using batch processing
   */
  static async syncOrdersFromFluid(
    installationId: string,
    companyShop: string,
    authToken: string
  ): Promise<{ synced: number; errors: number }> {
    try {
      // Fetch all orders from Fluid (with pagination)
      let page = 1
      let hasMorePages = true
      let allOrders: any[] = []
      let syncedCount = 0
      let errorCount = 0
      const BATCH_SIZE = 100 // Process orders in batches of 100

      // First, collect all orders from all pages
      while (hasMorePages) {
        const fluidResponse = await this.fetchOrdersFromFluid(companyShop, authToken, page, 50)
        allOrders.push(...fluidResponse.orders)

        // Check if there are more pages
        if (fluidResponse.meta.pagination) {
          hasMorePages = page < fluidResponse.meta.pagination.total_pages
          page++
        } else if (fluidResponse.meta.current_page && fluidResponse.meta.total_count) {
          // Fallback to current_page and total_count if pagination object doesn't exist
          const calculatedTotalPages = Math.ceil(fluidResponse.meta.total_count / 50)
          hasMorePages = page < calculatedTotalPages
          page++
        } else {
          hasMorePages = false
        }
      }

      // Process orders in batches for optimal performance
      for (let i = 0; i < allOrders.length; i += BATCH_SIZE) {
        const batch = allOrders.slice(i, i + BATCH_SIZE)

        try {
          // Prepare batch data
          const orderValues = batch.map(fluidOrder => {
            const customerEmail = fluidOrder.customer?.email || null
            const customerName = fluidOrder.customer?.name ||
              (fluidOrder.customer?.first_name && fluidOrder.customer?.last_name
                ? `${fluidOrder.customer.first_name} ${fluidOrder.customer.last_name}`
                : null)

            return {
              id: 'gen_random_uuid()',
              installationId,
              fluidOrderId: fluidOrder.id.toString(),
              orderNumber: fluidOrder.order_number || null,
              amount: fluidOrder.amount || null,
              status: fluidOrder.status || null,
              customerEmail,
              customerName,
              itemsCount: fluidOrder.items_count || null,
              orderData: JSON.stringify(fluidOrder),
              createdAt: 'NOW()',
              updatedAt: 'NOW()'
            }
          })

          // Build batch upsert query
          const values = orderValues.map((_, index) =>
            `(gen_random_uuid(), $${index * 11 + 1}, $${index * 11 + 2}, $${index * 11 + 3}, $${index * 11 + 4}, $${index * 11 + 5}, $${index * 11 + 6}, $${index * 11 + 7}, $${index * 11 + 8}, $${index * 11 + 9}::jsonb, NOW(), NOW())`
          ).join(', ')

          const params = orderValues.flatMap(order => [
            order.installationId,
            order.fluidOrderId,
            order.orderNumber,
            order.amount,
            order.status,
            order.customerEmail,
            order.customerName,
            order.itemsCount,
            order.orderData
          ])

          // Execute batch upsert
          await prisma.$executeRawUnsafe(`
            INSERT INTO orders (
              id, "installationId", "fluidOrderId", "orderNumber", amount, status,
              "customerEmail", "customerName", "itemsCount", "orderData", "createdAt", "updatedAt"
            ) VALUES ${values}
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
          `, ...params)

          syncedCount += batch.length
        } catch (error) {
          console.error(`Error syncing batch of ${batch.length} orders:`, error)
          errorCount += batch.length
        }
      }

      return { synced: syncedCount, errors: errorCount }
    } catch (error) {
      console.error('Error syncing orders from Fluid:', error)
      throw error
    }
  }

  /**
   * Get orders from our database for an installation
   */
  static async getOrdersForInstallation(installationId: string) {
    return await prisma.$queryRaw`
      SELECT * FROM orders 
      WHERE "installationId" = ${installationId}
      ORDER BY "updatedAt" DESC
    `
  }

  /**
   * Fetch orders from Fluid API (for testing token functionality)
   */
  static async fetchOrdersFromFluid(
    companyShop: string,
    authToken: string,
    page: number = 1,
    perPage: number = 10
  ): Promise<FluidOrdersResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString()
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      // Try multiple API endpoints for orders
      const possibleEndpoints = [
        `https://${companyShop}.fluid.app/api/v202506/orders?${queryParams}`, // Latest version
        `https://${companyShop}.fluid.app/api/v2/orders?${queryParams}`, // v2 version
        `https://api.fluid.app/api/v2/orders?company=${companyShop}&${queryParams}` // global API
      ];

      let response = null;

      for (const endpoint of possibleEndpoints) {
        try {
          response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });

          if (response.ok) {
            break;
          } else {
          }
        } catch (endpointError: any) {
        }
      }

      if (!response || !response.ok) {
        throw new Error(`All orders API endpoints failed. Last status: ${response?.status || 'No response'}`);
      }

      clearTimeout(timeoutId)

      const data = await response.json()
      return data as FluidOrdersResponse
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error) {
        throw new Error(`Failed to fetch orders from Fluid: ${error.message}`)
      }
      throw new Error('Failed to fetch orders from Fluid: Unknown error')
    }
  }
}
