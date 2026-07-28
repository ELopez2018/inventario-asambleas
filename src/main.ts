import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// sockjs-client espera un `global` estilo Node en el navegador; sin este polyfill
// revienta al importarse y tumba el arranque del layout autenticado.
(globalThis as unknown as { global: typeof globalThis }).global = globalThis;

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
