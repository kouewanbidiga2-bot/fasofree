import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// 🖥️ Capture `beforeinstallprompt` dès le démarrage (avant React) : l'événement
// n'est émis qu'une fois par chargement, souvent avant le montage des routes.
import './services/pwaInstall'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import SplashScreen from './components/SplashScreen.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <SplashScreen>
        <App />
      </SplashScreen>
    </ThemeProvider>
  </React.StrictMode>,
)
