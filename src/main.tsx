import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Register PWA Service Worker for iPhone Home Screen loading, offline support & Web Push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        registration.update().catch(() => {});

        // Automatically check for SW updates when user re-opens the Home Screen PWA
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });
      })
      .catch(() => {
        // Ignore registration errors in restricted environments
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
