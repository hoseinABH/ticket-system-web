import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API } from './api';
import type { Booking } from './models';

@Injectable({ providedIn: 'root' })
export class BookingsService {
  private readonly http = inject(HttpClient);

  // The full response, not just the body: the status code says where the
  // payment saga ended up (201 confirmed, 202 still pending, 402 declined)
  // and Idempotent-Replayed says whether the server recognised a retry
  checkout(quoteToken: string, paymentToken: string, idempotencyKey: string) {
    return this.http.post<Booking>(
      `${API}/bookings/checkout`,
      { quoteToken, paymentToken },
      {
        headers: { 'Idempotency-Key': idempotencyKey },
        observe: 'response',
      },
    );
  }

  myBookings() {
    return this.http.get<Booking[]>(`${API}/bookings/my-bookings`);
  }

  cancel(id: string) {
    return this.http.post<Booking>(`${API}/bookings/${id}/cancel`, {});
  }
}
