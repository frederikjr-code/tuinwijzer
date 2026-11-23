import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import './index.css'
import App, { type Page } from './App.tsx'

const root = document.getElementById('root')!
const page = (root.dataset.page ?? 'home') as Page

createRoot(root).render(
  <StrictMode>
    <App page={page} />
  </StrictMode>,
)
