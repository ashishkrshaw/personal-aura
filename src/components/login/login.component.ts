import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  loginSuccess = output<void>();

  username = signal('');
  password = signal('');
  error = signal<string | null>(null);
  isLoading = signal(false);

  private correctUsername: string;
  private correctPassword: string;

  constructor() {
    // Fetch credentials at component instantiation time to avoid any race conditions.
    this.correctUsername = (window as any).runtimeConfig?.AURA_USERNAME || 'aura';
    this.correctPassword = (window as any).runtimeConfig?.AURA_PASSWORD || 'password';
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