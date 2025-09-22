import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiClient } from '../lib/api'

interface DashboardData {
  companyName: string
  logoUrl?: string
  installationId: string
}

export function DropletDashboard() {
  const [searchParams] = useSearchParams()
  const installationId = searchParams.get('installation_id')
  const fluidApiKey = searchParams.get('fluid_api_key')
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      console.log('🔍 DropletDashboard: Starting loadDashboardData')
      console.log('🔍 Installation ID:', installationId)
      console.log('🔍 Fluid API Key:', fluidApiKey)
      console.log('🔍 API Base URL:', import.meta.env.VITE_API_BASE_URL)
      
      if (!installationId) {
        console.log('❌ Missing installation ID')
        setError('Missing installation ID')
        setIsLoading(false)
        return
      }

      if (!fluidApiKey) {
        console.log('❌ Missing Fluid API key')
        setError('Missing Fluid API key')
        setIsLoading(false)
        return
      }

      try {
        const apiUrl = `/api/droplet/dashboard/${installationId}?fluid_api_key=${fluidApiKey}`
        console.log('🚀 Making API request to:', apiUrl)
        console.log('🚀 Full URL will be:', `${import.meta.env.VITE_API_BASE_URL}${apiUrl}`)
        
        const response = await apiClient.get(apiUrl)
        console.log('✅ API Response received:', response.data)
        setDashboardData(response.data.data)
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold text-gray-800">
            Loading Dashboard...
          </h3>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-5 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Simple Header with Company Info */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            {dashboardData?.logoUrl && (
              <div className="w-16 h-16 rounded-xl p-2 shadow-lg bg-white/95 flex items-center justify-center">
                <img 
                  src={dashboardData.logoUrl} 
                  alt={`${dashboardData.companyName} logo`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Hide logo if it fails to load
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold">
                {dashboardData?.companyName || 'Your Business'}
              </h1>
              <p className="text-blue-100 text-sm mt-1">Welcome to your Fluid droplet</p>
            </div>
          </div>
        </div>
      </div>

      {/* Simple Content Area */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Installation Successful!
            </h2>
            <p className="text-gray-600 mb-4">
              Your Fluid droplet is now active and ready to use.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
              <p><strong>Company:</strong> {dashboardData?.companyName}</p>
              <p><strong>Installation ID:</strong> {dashboardData?.installationId}</p>
              <p><strong>Status:</strong> Active</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
