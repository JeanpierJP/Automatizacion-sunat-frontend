import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import InvoicesDashboard from './InvoicesDashboard.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <InvoicesDashboard />
  </StrictMode>,
)
