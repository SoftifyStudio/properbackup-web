import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { consumeAgentSessionHash } from './auth/hashBootstrap.js';
import './index.css';

consumeAgentSessionHash();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <App />
    </div>
  </React.StrictMode>,
);
