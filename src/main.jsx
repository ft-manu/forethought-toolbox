import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Popup } from './popup/Popup'

// Theme detection logic for Chrome extension CSP compliance
const savedTheme = localStorage.getItem('forethought_theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const theme = savedTheme || (prefersDark ? 'dark' : 'light');
document.documentElement.classList.toggle('dark', theme === 'dark');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
