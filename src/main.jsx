import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import React from 'react';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { SettingsProvider } from './contexts/SettingsContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';

// CRITICAL: Force clear any existing Service Workers that might be caching an old version
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      console.log('🧹 [ServiceWorker] Unregistering zombie worker:', registration.scope);
      registration.unregister();
    }
  });
}

// Add app versioning debug info
console.log('🚀 [App Status] Latest deployment version initialized at:', new Date().toLocaleString());
console.log('🕒 [Cache Status] Strict no-cache policy applied to entry point.');


// Error Boundary to catch runtime errors that cause blank pages
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Check if it's a chunk loading error (common after new deployments)
    const isChunkError = error?.name === 'ChunkLoadError' || 
                         error?.message?.includes('Failed to fetch dynamically imported module') ||
                         error?.toString().includes('Failed to fetch dynamically imported module');
                         
    if (isChunkError) {
      console.warn("🚀 [Error Boundary] Detected chunk loading error. Attempting automatic recovery...");
      const lastReload = sessionStorage.getItem('last_chunk_error_reload');
      const now = Date.now();
      
      // Prevent infinite reload loops (only reload if we haven't in the last 10 seconds)
      if (!lastReload || (now - parseInt(lastReload)) > 10000) {
        sessionStorage.setItem('last_chunk_error_reload', now.toString());
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        return;
      }
    }
    
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.toString() || '';
      const isChunkError = errorMsg.includes('Failed to fetch dynamically imported module');

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl border border-red-100 dark:border-red-900 max-w-lg w-full text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-4 italic tracking-tight uppercase">Something went wrong</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium leading-relaxed">
              {isChunkError 
                ? "A new version of the app was recently deployed. We need to refresh your browser to load the latest features." 
                : "The application encountered an unexpected error and could not load."}
            </p>
            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-xl text-[10px] font-mono mb-6 text-red-500 overflow-auto max-h-32 text-left border border-red-100/50 dark:border-red-900/50">
              {errorMsg}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-[0.98]"
            >
              Reload Application
            </button>
            <p className="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              AIPrep365 Platform
            </p>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <SettingsProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </SettingsProvider>
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>
);