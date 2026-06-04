import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Koder: #root 元素未找到');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
