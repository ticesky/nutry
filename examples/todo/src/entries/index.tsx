import {createRoot} from 'react-dom/client';
import '@/styles/index.js';
import App from '@/components/App/index';

const root = createRoot(document.body.appendChild(document.createElement('div')));
root.render(<App />);
