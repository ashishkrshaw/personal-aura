import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  theme = signal<'light' | 'dark'>('dark');

  constructor() {
    const savedTheme = localStorage.getItem('aura-theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      this.theme.set(savedTheme);
    } else {
      this.theme.set(prefersDark ? 'dark' : 'light');
    }

    effect(() => {
      const currentTheme = this.theme();
      localStorage.setItem('aura-theme', currentTheme);
      if (currentTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
  }

  toggleTheme() {
    this.theme.update(current => (current === 'light' ? 'dark' : 'light'));
  }
}
