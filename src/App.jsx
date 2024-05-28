import { useState } from 'react'
import './App.css'
import Home from '../components/main/Home'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <div className="gradient"></div>
      <Home></Home>
    </>
  )
}

export default App
