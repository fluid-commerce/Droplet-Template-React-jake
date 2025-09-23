import { prisma } from '../db'

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
        console.log(`🔍 Trying products API endpoint: ${endpoint}`);

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
            console.log(`✅ Success with products endpoint: ${endpoint}`);
            break;
          } else {
            console.log(`❌ Failed with ${endpoint}: ${response.status} ${response.statusText}`);
            // Try to get response body for more details
            try {
              const errorBody = await response.text();
              console.log(`❌ Error response body: ${errorBody}`);
            } catch (bodyError) {
              console.log(`❌ Could not read error response body`);
            }
          }
        } catch (endpointError: any) {
          console.log(`❌ Error with ${endpoint}: ${endpointError?.message || endpointError}`);
          console.log(`❌ Error type: ${endpointError?.name}`);
          console.log(`❌ Error code: ${endpointError?.code}`);
          if (endpointError?.cause) {
            console.log(`❌ Error cause: ${endpointError.cause}`);
          }
        }
      }

      if (!response || !response.ok) {
        throw new Error(`All product API endpoints failed. Last status: ${response?.status || 'No response'}`);
      }

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Failed to fetch products from Fluid: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Fluid API took too long to respond')
      }
      throw error
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
            await prisma.$executeRaw`
              INSERT INTO products (
                id, "installationId", "fluidProductId", title, sku, description, 
                "imageUrl", status, price, "inStock", public, "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), ${installationId}, ${fluidProduct.id.toString()}, 
                ${fluidProduct.title}, ${fluidProduct.sku || null}, ${fluidProduct.description || null},
                ${fluidProduct.image_url || null}, ${fluidProduct.status || null}, 
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
    return await prisma.$queryRaw`
      SELECT * FROM products 
      WHERE "installationId" = ${installationId}
      ORDER BY "updatedAt" DESC
    `
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
   * Sync orders from Fluid to our database
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
      let syncedCount = 0
      let errorCount = 0

      while (hasMorePages) {
        const fluidResponse = await this.fetchOrdersFromFluid(companyShop, authToken, page, 50)
        
        console.log(`📄 Processing page ${page} of orders:`, {
          ordersCount: fluidResponse.orders.length,
          meta: fluidResponse.meta,
          hasPagination: !!fluidResponse.meta.pagination,
          currentPage: fluidResponse.meta.current_page,
          totalCount: fluidResponse.meta.total_count,
          paginationObject: fluidResponse.meta.pagination
        })
        
        // Log the first few order IDs to verify we're getting real data
        if (fluidResponse.orders.length > 0) {
          console.log(`📋 Sample order IDs:`, fluidResponse.orders.slice(0, 3).map(o => o.id))
        }
        
        // Process each order
        for (const fluidOrder of fluidResponse.orders) {
          try {
            // Extract customer information
            const customerEmail = fluidOrder.customer?.email || null
            const customerName = fluidOrder.customer?.name || 
              (fluidOrder.customer?.first_name && fluidOrder.customer?.last_name 
                ? `${fluidOrder.customer.first_name} ${fluidOrder.customer.last_name}` 
                : null)

            await prisma.$executeRaw`
              INSERT INTO orders (
                id, "installationId", "fluidOrderId", "orderNumber", amount, status,
                "customerEmail", "customerName", "itemsCount", "orderData", "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), ${installationId}, ${fluidOrder.id.toString()}, 
                ${fluidOrder.order_number || null}, ${fluidOrder.amount || null}, ${fluidOrder.status || null},
                ${customerEmail}, ${customerName}, ${fluidOrder.items_count || null},
                ${fluidOrder}::jsonb, NOW(), NOW()
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
            `
            syncedCount++
          } catch (error) {
            console.error(`Error syncing order ${fluidOrder.id}:`, error)
            errorCount++
          }
        }

        // Check if there are more pages
        if (fluidResponse.meta.pagination) {
          hasMorePages = page < fluidResponse.meta.pagination.total_pages
          console.log(`🔄 Pagination logic (pagination object): page ${page} < ${fluidResponse.meta.pagination.total_pages} = ${hasMorePages}`)
          page++
        } else if (fluidResponse.meta.current_page && fluidResponse.meta.total_count) {
          // Fallback to current_page and total_count if pagination object doesn't exist
          const totalPages = Math.ceil(fluidResponse.meta.total_count / 50) // Assuming 50 per page
          hasMorePages = page < totalPages
          console.log(`🔄 Pagination logic (fallback): page ${page} < ${totalPages} (total: ${fluidResponse.meta.total_count}) = ${hasMorePages}`)
          page++
        } else {
          hasMorePages = false
          console.log(`🔄 Pagination logic (no pagination data): hasMorePages = false`)
        }
      }

      console.log(`✅ Orders sync completed:`, {
        totalSynced: syncedCount,
        totalErrors: errorCount,
        totalPages: page - 1
      })
      
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
        console.log(`🔍 Trying orders API endpoint: ${endpoint}`);

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
            console.log(`✅ Success with orders endpoint: ${endpoint}`);
            break;
          } else {
            console.log(`❌ Failed with ${endpoint}: ${response.status} ${response.statusText}`);
            // Try to get response body for more details
            try {
              const errorBody = await response.text();
              console.log(`❌ Error response body: ${errorBody}`);
            } catch (bodyError) {
              console.log(`❌ Could not read error response body`);
            }
          }
        } catch (endpointError: any) {
          console.log(`❌ Error with ${endpoint}: ${endpointError?.message || endpointError}`);
          console.log(`❌ Error type: ${endpointError?.name}`);
          console.log(`❌ Error code: ${endpointError?.code}`);
          if (endpointError?.cause) {
            console.log(`❌ Error cause: ${endpointError.cause}`);
          }
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
