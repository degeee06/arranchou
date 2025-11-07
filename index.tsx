import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { unregisterServiceWorkers } from './utils/serviceWorkerDeregistration';

// Actively unregister any existing service workers to prevent caching issues.
// This is crucial for ensuring users get the latest version after fixing cache-related bugs.
unregisterServiceWorkers();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);