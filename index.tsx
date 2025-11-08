
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';

import { AppComponent } from './src/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(),
  ]
});

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(registration => {
      console.log('AURA Service Worker registered: ', registration);
    }).catch(registrationError => {
      console.log('AURA Service Worker registration failed: ', registrationError);
    });
  });
}

// AI Studio always uses an `index.tsx` file for all project types.