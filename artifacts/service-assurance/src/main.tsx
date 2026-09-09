import { createRoot } from 'react-dom/client';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { getToken } from '@/lib/token';
import App from './App';
import './index.css';

setBaseUrl(import.meta.env.VITE_API_BASE_URL || null);
setAuthTokenGetter(() => getToken());

createRoot(document.getElementById('root')!).render(<App />);
