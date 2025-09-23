import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'

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

interface Order {
  id: string
  fluidOrderId: string
  orderNumber?: string
  amount?: string
  status?: string
  customerEmail?: string
  customerName?: string
  itemsCount?: number
  orderData?: any
  createdAt: string
  updatedAt: string
}

interface OrdersResponse {
  success: boolean
  data: {
    orders: Order[]
    installation: {
      id: string
      companyName: string
    }
  }
}

interface OrdersSyncResponse {
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
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSyncingOrders, setIsSyncingOrders] = useState(false)
  const [isTestingOrders, setIsTestingOrders] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [ordersSyncMessage, setOrdersSyncMessage] = useState<string | null>(null)
  const [ordersMessage, setOrdersMessage] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Helper function to format colors
  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  // Pagination helpers
  const getCurrentProducts = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return products.slice(startIndex, endIndex)
  }

  const getCurrentOrders = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return orders.slice(startIndex, endIndex)
  }

  const getTotalPages = () => {
    const items = activeTab === 'products' ? products : orders
    return Math.ceil(items.length / itemsPerPage)
  }

  const goToNextPage = () => {
    if (currentPage < getTotalPages()) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
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

  // Fetch orders from our database
  const fetchOrders = async () => {
    try {
      setError(null)
      
      const response = await apiClient.get(`/api/orders/${installationId}`)
      const data = response.data as OrdersResponse
      
      if (data.success) {
        setOrders(data.data.orders)
        setCompanyName(data.data.installation.companyName)
      } else {
        setError('Failed to fetch orders')
      }
    } catch (err: any) {
      console.error('Error fetching orders:', err)
      setError(err.response?.data?.message || 'Failed to fetch orders')
    }
  }

  // Sync orders from Fluid API
  const syncOrders = async () => {
    try {
      setIsSyncingOrders(true)
      setError(null)
      setOrdersSyncMessage(null)

      const response = await apiClient.post(`/api/orders/${installationId}/sync`)
      const data = response.data as OrdersSyncResponse

      if (data.success) {
        setOrdersSyncMessage(data.data.message)
        // Refresh orders after sync
        await fetchOrders()
      } else {
        setError('Failed to sync orders')
      }
    } catch (err: any) {
      console.error('Error syncing orders:', err)
      setError(err.response?.data?.message || 'Failed to sync orders from Fluid')
    } finally {
      setIsSyncingOrders(false)
    }
  }

  // Test orders from Fluid API
  const testOrders = async () => {
    try {
      setIsTestingOrders(true)
      setError(null)
      setOrdersMessage(null)

      const response = await apiClient.get(`/api/orders/${installationId}/fluid`)
      const data = response.data as OrdersResponse

      if (data.success) {
        setOrdersMessage(`Successfully fetched ${data.data.orders.length} orders from Fluid API`)
      } else {
        setError('Failed to fetch orders')
      }
    } catch (err: any) {
      console.error('Error testing orders:', err)
      setError(err.response?.data?.message || 'Failed to fetch orders from Fluid')
    } finally {
      setIsTestingOrders(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when switching tabs
  }, [activeTab])

  useEffect(() => {
    // Only fetch data when installationId changes, not when switching tabs
    fetchProducts()
    fetchOrders()
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
      {/* Header with tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Products and Orders from {companyName}
          </h3>
          <p className="text-sm text-gray-600">
            {activeTab === 'products' 
              ? `${products.length} products synced from Fluid`
              : `${orders.length} orders synced from Fluid`
            }
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'products'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'orders'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Orders
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        {activeTab === 'products' ? (
          <button
            onClick={syncProducts}
            disabled={isSyncing || isSyncingOrders || isTestingOrders}
            className="inline-flex items-center px-3 py-1.5 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: brandGuidelines?.color
                ? formatColor(brandGuidelines.color)
                : '#3b82f6'
            }}
          >
            {isSyncing ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Products
              </>
            )}
          </button>
        ) : (
          <button
            onClick={syncOrders}
            disabled={isSyncing || isSyncingOrders || isTestingOrders}
            className="inline-flex items-center px-3 py-1.5 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: brandGuidelines?.color
                ? formatColor(brandGuidelines.color)
                : '#3b82f6'
            }}
          >
            {isSyncingOrders ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Orders
              </>
            )}
          </button>
        )}

        <button
          onClick={testOrders}
          disabled={isSyncing || isSyncingOrders || isTestingOrders}
          className="inline-flex items-center px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
        >
          {isTestingOrders ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
              Testing...
            </>
          ) : (
            <>
              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Sync Orders
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

      {/* Orders sync message */}
      {ordersSyncMessage && (
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
            <span className="text-sm font-medium text-gray-900">{ordersSyncMessage}</span>
          </div>
        </div>
      )}

      {/* Orders message */}
      {ordersMessage && (
        <div className="p-4 rounded-lg border bg-green-50 border-green-200">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-green-800">{ordersMessage}</span>
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

      {/* Content based on active tab */}
      {activeTab === 'products' ? (
        /* Products list */
        products.length > 0 ? (
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
                  {getCurrentProducts().map((product) => (
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
            
            {/* Pagination */}
            {getTotalPages() > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === getTotalPages()}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                      {' '}to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * itemsPerPage, products.length)}
                      </span>
                      {' '}of{' '}
                      <span className="font-medium">{products.length}</span>
                      {' '}results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={goToNextPage}
                        disabled={currentPage === getTotalPages()}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products yet</h3>
            <p className="text-gray-600">
              Use the sync button above to sync products from Fluid
            </p>
          </div>
        )
      ) : (
        /* Orders list */
        orders.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getCurrentOrders().map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {order.orderNumber || `#${order.fluidOrderId}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {order.fluidOrderId}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {order.customerName || '-'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.customerEmail || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.amount || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: order.status === 'completed' || order.status === 'fulfilled'
                              ? (brandGuidelines?.color 
                                  ? `${formatColor(brandGuidelines.color)}20` 
                                  : '#dcfce720')
                              : order.status === 'pending' || order.status === 'processing'
                              ? '#fef3c720'
                              : '#f3f4f6',
                            color: order.status === 'completed' || order.status === 'fulfilled'
                              ? (brandGuidelines?.color 
                                  ? formatColor(brandGuidelines.color) 
                                  : '#16a34a')
                              : order.status === 'pending' || order.status === 'processing'
                              ? '#d97706'
                              : '#6b7280'
                          }}
                        >
                          {order.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.itemsCount || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {getTotalPages() > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === getTotalPages()}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                      {' '}to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * itemsPerPage, orders.length)}
                      </span>
                      {' '}of{' '}
                      <span className="font-medium">{orders.length}</span>
                      {' '}results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={goToNextPage}
                        disabled={currentPage === getTotalPages()}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
            <p className="text-gray-600">
              Use the sync button above to sync orders from Fluid
            </p>
          </div>
        )
      )}
    </div>
  )
}
