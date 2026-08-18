import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { consumeLogoutSignal } from './lib/logoutSignal';

// Consume a one-time `?logout=1` entry signal BEFORE React mounts, so the session
// is cleared and the URL is cleaned before AuthContext restores from storage.
consumeLogoutSignal();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
