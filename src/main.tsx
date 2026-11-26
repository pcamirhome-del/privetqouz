import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {initPWAUpdater} from './services/pwaUpdater';

initPWAUpdater();

createRoot(document.getElementById('root')!).render(<App />);
