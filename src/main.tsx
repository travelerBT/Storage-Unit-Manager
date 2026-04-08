import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { analyticsPromise } from '@/lib/firebase/analytics'

// Initialize Analytics (fire-and-forget)
void analyticsPromise

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
