import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { errorMessage } from '../core/api';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="card auth">
      <div class="tabs">
        <button [class.ghost]="mode() !== 'login'" (click)="mode.set('login')">Sign in</button>
        <button [class.ghost]="mode() !== 'register'" (click)="mode.set('register')">Create account</button>
      </div>

      @if (expired()) {
        <div class="alert warn">Your session ended. Please sign in again.</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" />
        </div>
        <div class="field">
          <label for="password">Password (at least 6 characters)</label>
          <input
            id="password"
            type="password"
            formControlName="password"
            [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
          />
        </div>

        @if (error()) {
          <div class="alert error">{{ error() }}</div>
        }

        <button type="submit" [disabled]="form.invalid || busy()">
          {{ busy() ? 'Please wait…' : mode() === 'login' ? 'Sign in' : 'Create account' }}
        </button>
      </form>
    </div>
  `,
  styles: `
    .auth { max-width: 420px; margin: 48px auto; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .tabs button { flex: 1; }
    .field { margin-bottom: 14px; }
    form button { width: 100%; }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // ?expired=1, set by the interceptor when the API rejects the token
  readonly expired = input<string>();

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit() {
    const { email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);

    const login$ = this.auth.login(email, password);
    const request$ =
      this.mode() === 'register'
        ? this.auth.register(email, password).pipe(switchMap(() => login$))
        : login$;

    request$.subscribe({
      next: () => void this.router.navigate(['/flights']),
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.busy.set(false);
      },
    });
  }
}
