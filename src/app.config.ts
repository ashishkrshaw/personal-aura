
import { InjectionToken } from '@angular/core';

export interface AppConfig {
  API_KEY: string;
  AURA_USERNAME: string;
  AURA_PASSWORD: string;
  MONGO_URI: string;
  AURA_BACKEND_URL: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');
