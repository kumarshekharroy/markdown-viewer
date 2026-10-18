import React from 'react';
import { isTauri } from '@tauri-apps/api/core';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerFileLaunchQueue } from './lib/fileLaunch';
import './styles.css';

registerFileLaunchQueue();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (!isTauri() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL }).catch(() => {
      // Offline support is progressive; the app remains usable if registration is blocked.
    });
  });
}
