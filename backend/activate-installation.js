import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function activateInstallation() {
  try {
    const installationId = 'dri_1ckec6swfdj6drmrhbt3vbunzgiseiajk'
    
    console.log(`Activating installation: ${installationId}`)
    
    const result = await prisma.installation.update({
      where: { fluidId: installationId },
      data: { isActive: true }
    })
    
    console.log('Installation activated:', result)
    
    // Test the dashboard endpoint
    const response = await fetch(`https://droplet-backend-go5d.onrender.com/api/droplet/dashboard/${installationId}?fluid_api_key=dit_2Dgj5bVmqli4PeQleHwK4nQ8j5HD1ZOol`)
    const data = await response.json()
    console.log('Dashboard response:', data)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

activateInstallation()
