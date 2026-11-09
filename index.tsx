import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const platform = window.electronAPI?.platform;
if (platform === 'win32' || (!platform && /Win/i.test(navigator.platform))) {
  document.documentElement.classList.add('platform-windows');
}

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
