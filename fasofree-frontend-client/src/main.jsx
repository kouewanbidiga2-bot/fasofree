/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// 🖥️ Capture `beforeinstallprompt` dès le démarrage (avant React) : l'événement
// n'est émis qu'une fois par chargement, souvent avant le montage des routes.
import './services/pwaInstall'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import { DarkModeProvider } from './contexts/DarkModeContext.jsx'
import { LanguageProvider } from './contexts/LanguageContext.jsx'
import { QueryClientProvider } from '@tanstack/react-query'
import queryClient from './services/queryClient'
import SplashScreen from './components/SplashScreen.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DarkModeProvider>
      <LanguageProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <SplashScreen>
              <App />
            </SplashScreen>
          </QueryClientProvider>
        </ThemeProvider>
      </LanguageProvider>
    </DarkModeProvider>
  </React.StrictMode>,
)
