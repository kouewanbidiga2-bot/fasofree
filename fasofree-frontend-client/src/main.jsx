import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import { DarkModeProvider } from './contexts/DarkModeContext.jsx'
import { LanguageProvider } from './contexts/LanguageContext.jsx'
import SplashScreen from './components/SplashScreen.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DarkModeProvider>
      <LanguageProvider>
        <ThemeProvider>
          <SplashScreen>
            <App />
          </SplashScreen>
        </ThemeProvider>
      </LanguageProvider>
    </DarkModeProvider>
  </React.StrictMode>,
)
