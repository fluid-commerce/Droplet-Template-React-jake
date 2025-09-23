import { useState } from 'react'
import { ProductsTab } from './ProductsTab'
import { OrdersTab } from './OrdersTab'

interface ProductsSectionProps {
  installationId: string
  brandGuidelines?: {
    name: string
    logo_url?: string
    color?: string
    secondary_color?: string
  }
}

export function ProductsSection({ installationId, brandGuidelines }: ProductsSectionProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products')
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // Helper function to format colors
  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  const handleTabChange = (tab: 'products' | 'orders') => {
    setActiveTab(tab)
    setSyncMessage(null) // Clear sync message when switching tabs
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange('products')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'products'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            style={{
              ...(activeTab === 'products' && brandGuidelines?.color
                ? {
                    borderColor: formatColor(brandGuidelines.color),
                    color: formatColor(brandGuidelines.color)
                  }
                : {})
            }}
          >
            Products
          </button>
          <button
            onClick={() => handleTabChange('orders')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'orders'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            style={{
              ...(activeTab === 'orders' && brandGuidelines?.color
                ? {
                    borderColor: formatColor(brandGuidelines.color),
                    color: formatColor(brandGuidelines.color)
                  }
                : {})
            }}
          >
            Orders
          </button>
        </nav>
      </div>

      {/* Sync Message */}
      {syncMessage && (
        <div className="p-4 rounded-lg border border-green-200 bg-green-50">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-800 text-sm">{syncMessage}</span>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'products' ? (
        <ProductsTab
          installationId={installationId}
          brandGuidelines={brandGuidelines}
          onSyncMessage={setSyncMessage}
        />
      ) : (
        <OrdersTab
          installationId={installationId}
          brandGuidelines={brandGuidelines}
          onSyncMessage={setSyncMessage}
        />
      )}
    </div>
  )
}