import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Projects from './pages/Projects'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/projects" element={<Projects />} />
    </Routes>
  )
}

export default App
