import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Tailwind CDN 로드
const link = document.createElement('link')
link.href = 'https://cdn.tailwindcss.com'
link.rel = 'stylesheet'
document.head.appendChild(link)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)