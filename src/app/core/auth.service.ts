import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API } from './api';
import type { AuthResponse } from './models';

const STORAGE_KEY = 'ticket-system.session';

interface Session {
  token: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly session = signal<Session | null>(readSession());

  readonly token = computed(() => this.session()?.token ?? null);
  readonly email = computed(() => this.session()?.email ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);

  register(email: string, password: string) {
    return this.http.post(`${API}/auth/register`, { email, password });
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API}/auth/login`, { email, password })
      .pipe(
        tap((res) =>
          this.setSession({ token: res.accessToken, email: res.user.email }),
        ),
      );
  }

  // Revokes the token server-side (Redis blocklist), then forgets it locally
  logout() {
    const done = () => {
      this.setSession(null);
      void this.router.navigate(['/login']);
    };
    if (!this.token()) return done();
    this.http.post(`${API}/auth/logout`, {}).subscribe({
      next: done,
      error: done,
    });
  }

  // Called when the API rejects the token (expired or revoked)
  expire() {
    this.setSession(null);
    void this.router.navigate(['/login'], {
      queryParams: { expired: 1 },
    });
  }

  private setSession(session: Session | null) {
    this.session.set(session);
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode): the session lives in memory only
    }
  }
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
