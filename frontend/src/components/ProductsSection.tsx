import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'

interface Product {
  id: string
  fluidProductId: string
  title: string
  sku?: string
  description?: string
  imageUrl?: string
  status?: string
  price?: string
  inStock: boolean
  public: boolean
  createdAt: string
  updatedAt: string
}

interface ProductsResponse {
  success: boolean
  data: {
    products: Product[]
    installation: {
      id: string
      companyName: string
    }
  }
}

interface SyncResponse {
  success: boolean
  data: {
    message: string
    synced: number
    errors: number
    installation: {
      id: string
      companyName: string
    }
  }
}

interface ProductsSectionProps {
  installationId: string
  brandGuidelines?: {
    color?: string
    secondary_color?: string
  }
}

export function ProductsSection({ installationId, brandGuidelines }: ProductsSectionProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string>('')

  // Helper function to format colors
  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  // Fetch products from our database
  const fetchProducts = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await apiClient.get(`/api/products/${installationId}`)
      const data = response.data as ProductsResponse
      
      if (data.success) {
        setProducts(data.data.products)
        setCompanyName(data.data.installation.companyName)
      } else {
        setError('Failed to fetch products')
      }
    } catch (err: any) {
      console.error('Error fetching products:', err)
      setError(err.response?.data?.message || 'Failed to fetch products')
    } finally {
      setIsLoading(false)
    }
  }

  // Sync products from Fluid API
  const syncProducts = async () => {
    try {
      setIsSyncing(true)
      setError(null)
      setSyncMessage(null)
      
      const response = await apiClient.post(`/api/products/${installationId}/sync`)
      const data = response.data as SyncResponse
      
      if (data.success) {
        setSyncMessage(data.data.message)
        // Refresh products after sync
        await fetchProducts()
      } else {
        setError('Failed to sync products')
      }
    } catch (err: any) {
      console.error('Error syncing products:', err)
      setError(err.response?.data?.message || 'Failed to sync products from Fluid')
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [installationId])

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center justify-center py-8">
          <div 
            className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{
              borderColor: brandGuidelines?.color 
                ? `${formatColor(brandGuidelines.color)}20` 
                : '#e5e7eb20',
              borderTopColor: brandGuidelines?.color 
                ? formatColor(brandGuidelines.color) 
                : '#6b7280'
            }}
          ></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with sync button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Products from {companyName}
          </h3>
          <p className="text-sm text-gray-600">
            {products.length} products synced from Fluid
          </p>
        </div>
        
        <button
          onClick={syncProducts}
          disabled={isSyncing}
          className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: brandGuidelines?.color 
              ? formatColor(brandGuidelines.color) 
              : '#3b82f6'
          }}
        >
          {isSyncing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Syncing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync from Fluid
            </>
          )}
        </button>
      </div>

      {/* Sync message */}
      {syncMessage && (
        <div 
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: brandGuidelines?.color 
              ? `${formatColor(brandGuidelines.color)}10` 
              : '#f0f9ff',
            borderColor: brandGuidelines?.color 
              ? `${formatColor(brandGuidelines.color)}30` 
              : '#bae6fd'
          }}
        >
          <div className="flex items-center">
            <svg 
              className="w-5 h-5 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              style={{
                color: brandGuidelines?.color 
                  ? formatColor(brandGuidelines.color) 
                  : '#0ea5e9'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-gray-900">{syncMessage}</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Products list */}
      {products.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {product.imageUrl && (
                          <div className="flex-shrink-0 h-10 w-10 mr-3">
                            <img
                              className="h-10 w-10 rounded-lg object-cover"
                              src={product.imageUrl}
                              alt={product.title}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {product.title}
                          </div>
                          {product.description && (
                            <div className="text-sm text-gray-500 truncate">
                              {product.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.sku || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.price || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: product.status === 'active' 
                            ? (brandGuidelines?.color 
                                ? `${formatColor(brandGuidelines.color)}20` 
                                : '#dcfce720')
                            : '#f3f4f6',
                          color: product.status === 'active'
                            ? (brandGuidelines?.color 
                                ? formatColor(brandGuidelines.color) 
                                : '#16a34a')
                            : '#6b7280'
                        }}
                      >
                        {product.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: product.inStock 
                            ? (brandGuidelines?.color 
                                ? `${formatColor(brandGuidelines.color)}20` 
                                : '#dcfce720')
                            : '#fee2e220',
                          color: product.inStock
                            ? (brandGuidelines?.color 
                                ? formatColor(brandGuidelines.color) 
                                : '#16a34a')
                            : '#dc2626'
                        }}
                      >
                        {product.inStock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products yet</h3>
          <p className="text-gray-600 mb-4">
            Sync products from Fluid to see them here
          </p>
          <button
            onClick={syncProducts}
            disabled={isSyncing}
            className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{
              backgroundColor: brandGuidelines?.color 
                ? formatColor(brandGuidelines.color) 
                : '#3b82f6'
            }}
          >
            {isSyncing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Products from Fluid
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
