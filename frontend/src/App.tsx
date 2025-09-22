import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { DropletDashboard } from './components/DropletDashboard'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DropletDashboard />} />
        <Route path="*" element={<DropletDashboard />} />
      </Routes>
    </Router>
  )
}

export default App
