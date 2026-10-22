import '@fontsource-variable/inter';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth';
import './styles.css';
import { aplicarTema, cargarTemaServidor, leerTema } from './tema';

// Aplica la paleta guardada antes de dibujar la página (evita un parpadeo de colores).
aplicarTema(leerTema());
// Después se pide la paleta vigente al servidor (y se vuelve a pedir al volver a esta pestaña).
cargarTemaServidor();
window.addEventListener('focus', cargarTemaServidor);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
