import React from 'react';
import ReactDOM from 'react-dom/client';
// Fix: Use a named import for the App component to align with the project's export patterns.
import { App } from './App';

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