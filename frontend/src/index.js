import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';

const clientId = (process.env.REACT_APP_CLIENT_ID || '').trim();
if (clientId) {
  axios.defaults.headers.common['x-client-id'] = clientId;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
