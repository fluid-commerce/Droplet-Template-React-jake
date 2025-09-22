import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiClient } from '../lib/api'

interface BrandGuidelines {
  name: string
  logo_url?: string
  color?: string
  secondary_color?: string
}

interface DashboardData {
  companyName: string
  logoUrl?: string
  installationId: string
  authenticationToken?: string // cdrtkn_ token for company API access
  brandGuidelines?: BrandGuidelines
}

export function DropletDashboard() {
  const [searchParams] = useSearchParams()
  const installationId = searchParams.get('installation_id') || searchParams.get('dri')
  const fluidApiKey = searchParams.get('fluid_api_key')
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [brandGuidelines, setBrandGuidelines] = useState<BrandGuidelines | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Helper function to format colors
  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  // Function to fetch brand guidelines from Fluid API
  const fetchBrandGuidelines = async (installationId: string, fluidApiKey: string) => {
    try {
      console.log('🎨 Fetching brand guidelines for installation:', installationId)
      const response = await apiClient.get(`/api/droplet/brand-guidelines/${installationId}?fluid_api_key=${fluidApiKey}`)
      const brandData = response.data.data
      console.log('✅ Brand guidelines loaded:', brandData)
      setBrandGuidelines(brandData)
      return brandData
    } catch (err: any) {
      console.log('⚠️ Failed to fetch brand guidelines:', err.response?.status, err.response?.data)
      // Don't fail the whole dashboard if brand guidelines fail
      return null
    }
  }


  useEffect(() => {
    const loadDashboardData = async () => {
      console.log('🔍 DropletDashboard: Starting loadDashboardData')
      console.log('🔍 Installation ID:', installationId)
      console.log('🔍 Fluid API Key:', fluidApiKey)
      console.log('🔍 API Base URL:', import.meta.env.VITE_API_BASE_URL)
      console.log('🔍 Current URL:', window.location.href)
      console.log('🔍 Search params:', window.location.search)
      console.log('🔍 All URL params:', Object.fromEntries(searchParams.entries()))
      
      // Check if we're missing both parameters - this indicates we're not in a proper Fluid embed
      if (!installationId && !fluidApiKey) {
        console.log('⚠️ No Fluid parameters found - this appears to be a direct access')
        setError('This droplet must be accessed through the Fluid platform. Please install it from the Fluid marketplace.')
        setIsLoading(false)
        return
      }

      if (!installationId) {
        console.log('❌ Missing installation ID')
        setError('Missing installation ID. Please try reinstalling the droplet from the Fluid marketplace.')
        setIsLoading(false)
        return
      }

      // If we don't have fluid_api_key, try the installation endpoint first
      if (!fluidApiKey) {
        console.log('⚠️ Missing Fluid API key, trying installation endpoint')
        try {
          const apiUrl = `/api/droplet/installation/${installationId}`
          console.log('🚀 Making API request to installation endpoint:', apiUrl)
          
          const response = await apiClient.get(apiUrl)
          console.log('✅ Installation API Response received:', response.data)
          setDashboardData(response.data.data)
          setIsLoading(false)
          return
        } catch (err: any) {
          console.log('❌ Installation endpoint failed:', err.response?.status, err.response?.data)
          // Continue to show error about missing API key
        }
      }

      if (!fluidApiKey) {
        console.log('❌ Missing Fluid API key')
        setError('Missing Fluid API key. Please try reinstalling the droplet from the Fluid marketplace.')
        setIsLoading(false)
        return
      }

      try {
        // Fetch dashboard data and brand guidelines in parallel
        const [dashboardResponse, brandData] = await Promise.all([
          apiClient.get(`/api/droplet/dashboard/${installationId}?fluid_api_key=${fluidApiKey}`),
          fetchBrandGuidelines(installationId, fluidApiKey)
        ])

        console.log('✅ Dashboard API Response received:', dashboardResponse.data)
        const dashboardData = dashboardResponse.data.data
        
        // If we have brand guidelines, merge them into dashboard data
        if (brandData) {
          dashboardData.brandGuidelines = brandData
        }
        
        setDashboardData(dashboardData)
      } catch (err: any) {
        console.error('❌ Failed to load dashboard data:', err)
        console.error('❌ Error details:', {
          message: err.message,
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          config: err.config
        })
        
        // If installation not found (404) or forbidden (403), it was likely uninstalled
        if (err.response?.status === 404 || err.response?.status === 403) {
          // Clear localStorage and redirect to fresh installation
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('droplet_session_') || key.includes(installationId!)) {
              localStorage.removeItem(key)
            }
          })
          
          // Redirect to installation flow
          window.location.href = '/'
          return
        }
        
        setError(err.response?.data?.message || 'Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [installationId, fluidApiKey])

  if (isLoading) {
    // Use brand colors if available, otherwise use default blue
    const defaultColor = '#2563eb'
    const primaryColor = brandGuidelines?.color ? formatColor(brandGuidelines.color) : defaultColor
    const lightColor = brandGuidelines?.color ? `${formatColor(brandGuidelines.color)}20` : `${defaultColor}20`
    
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          background: brandGuidelines?.color 
            ? `linear-gradient(135deg, ${lightColor}, ${formatColor(brandGuidelines.color)}10)`
            : 'linear-gradient(135deg, #f8fafc, #e0e7ff, #c7d2fe)'
        }}
      >
        <div className="text-center">
          <div 
            className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-6"
            style={{
              borderColor: `${primaryColor}20`,
              borderTopColor: primaryColor
            }}
          ></div>
          <h3 className="text-2xl font-semibold text-gray-800 mb-2">
            Loading {brandGuidelines?.name || 'Dashboard'}...
          </h3>
          <p className="text-gray-600 mt-2">Please wait while we set up your droplet</p>
        </div>
      </div>
    )
  }

  if (error) {
    const isAccessError = error.includes('This droplet must be accessed through the Fluid platform') || 
                         error.includes('Missing installation ID') || 
                         error.includes('Missing Fluid API key')
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Connection Error</h2>
          <p className="text-gray-600 mb-6 text-base">{error}</p>
          
          {isAccessError && (
            <div className="bg-blue-50 rounded-lg p-6 mb-6 text-left">
              <h3 className="text-base font-medium text-blue-900 mb-3">How to fix this:</h3>
              <ul className="text-sm text-blue-800 space-y-2">
                <li>• Make sure you're accessing this through the Fluid platform</li>
                <li>• If you just installed, try clicking the droplet again from your Fluid dashboard</li>
                <li>• If the problem persists, try uninstalling and reinstalling the droplet</li>
              </ul>
            </div>
          )}
          
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-base font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Full-width Header with Company Info */}
      <div 
        className="text-white"
        style={{
          background: dashboardData?.brandGuidelines?.color 
            ? `linear-gradient(135deg, ${formatColor(dashboardData.brandGuidelines.color)}, ${formatColor(dashboardData.brandGuidelines.secondary_color || dashboardData.brandGuidelines.color)})`
            : 'linear-gradient(135deg, #2563eb, #1d4ed8, #3730a3)'
        }}
      >
        <div className="w-full px-6 py-12">
          <div className="flex items-center gap-6">
            {(dashboardData?.brandGuidelines?.logo_url || dashboardData?.logoUrl) && (
              <div className="w-20 h-20 rounded-xl p-3 shadow-lg bg-white/95 flex items-center justify-center">
                <img 
                  src={dashboardData.brandGuidelines?.logo_url || dashboardData.logoUrl} 
                  alt={`${dashboardData.brandGuidelines?.name || dashboardData.companyName} logo`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Hide logo if it fails to load
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}
            <div>
              <h1 className="text-4xl font-bold">
                {dashboardData?.brandGuidelines?.name || dashboardData?.companyName || 'Your Business'}
              </h1>
              <p className="text-white/80 text-lg mt-2">Welcome to your Fluid droplet</p>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Content Area */}
      <div className="w-full px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{
                  backgroundColor: dashboardData?.brandGuidelines?.color 
                    ? `${formatColor(dashboardData.brandGuidelines.color)}15` 
                    : '#dcfce7'
                }}
              >
                <svg 
                  className="w-8 h-8" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  style={{
                    color: dashboardData?.brandGuidelines?.color 
                      ? formatColor(dashboardData.brandGuidelines.color)
                      : '#16a34a'
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                Installation Successful!
              </h2>
              <p className="text-gray-600 mb-6 text-lg">
                Your Fluid droplet is now active and ready to use.
              </p>
              <div 
                className="rounded-lg p-6 text-sm text-gray-700 max-w-2xl mx-auto"
                style={{
                  backgroundColor: dashboardData?.brandGuidelines?.color 
                    ? `${formatColor(dashboardData.brandGuidelines.color)}10` 
                    : '#f9fafb',
                  borderColor: dashboardData?.brandGuidelines?.color 
                    ? `${formatColor(dashboardData.brandGuidelines.color)}30` 
                    : '#e5e7eb'
                }}
              >
                <div className="space-y-3">
                  <p><strong>Company:</strong> {dashboardData?.brandGuidelines?.name || dashboardData?.companyName}</p>
                  <p><strong>Installation ID:</strong> {dashboardData?.installationId}</p>
                  <p><strong>Status:</strong> 
                    <span 
                      className="font-medium ml-1"
                      style={{
                        color: dashboardData?.brandGuidelines?.color 
                          ? formatColor(dashboardData.brandGuidelines.color)
                          : '#16a34a'
                      }}
                    >
                      Active
                    </span>
                  </p>
                  
                  {/* Authentication Tokens */}
                  <div className="border-t pt-3 mt-3">
                    <h4 className="font-semibold text-gray-900 mb-2">Authentication Tokens</h4>
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-xs text-gray-600">Droplet Token (dit_):</p>
                        <p className="text-xs font-mono bg-gray-100 p-2 rounded border break-all">
                          {fluidApiKey || 'Not available'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">For droplet authentication</p>
                      </div>
                      
                      {dashboardData?.authenticationToken && (
                        <div>
                          <p className="font-medium text-xs text-gray-600">Company Token (cdrtkn_):</p>
                          <p className="text-xs font-mono bg-gray-100 p-2 rounded border break-all">
                            {dashboardData.authenticationToken}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">For company API access (create orders, sync data, etc.)</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
