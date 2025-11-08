
import { ChangeDetectionStrategy, Component, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { APP_CONFIG, AppConfig } from '../../app.config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  loginSuccess = output<void>();
  private config = inject<AppConfig>(APP_CONFIG);

  username = signal('');
  password = signal('');
  error = signal<string | null>(null);
  isLoading = signal(false);

  private correctUsername: string;
  private correctPassword: string;

  constructor() {
    // Fetch credentials from the injected configuration to avoid race conditions.
    this.correctUsername = this.config.AURA_USERNAME || 'aura';
    this.correctPassword = this.config.AURA_PASSWORD || 'password';
  }

  login() {
    this.isLoading.set(true);
    this.error.set(null);

    // Simulate network delay for better UX
    setTimeout(() => {
      if (this.username() === this.correctUsername && this.password() === this.correctPassword) {
        this.loginSuccess.emit();
      } else {
        this.error.set('Invalid username or password.');
        this.isLoading.set(false);
      }
    }, 500);
  }
}
