import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API } from './api';
import type { FareQuote, Flight, Seat } from './models';

@Injectable({ providedIn: 'root' })
export class FlightsService {
  private readonly http = inject(HttpClient);

  seed() {
    return this.http.post<Flight[]>(`${API}/flights/seed`, {});
  }

  search(origin: string, destination: string) {
    return this.http.get<Flight[]>(`${API}/flights/search`, {
      params: { origin, destination },
    });
  }

  getFlight(id: string) {
    return this.http.get<Flight>(`${API}/flights/${id}`);
  }

  getSeatMap(id: string) {
    return this.http.get<Seat[]>(`${API}/flights/${id}/seats`);
  }

  quote(flightId: string, seatNumbers: string[]) {
    return this.http.post<FareQuote>(`${API}/flights/quote`, {
      flightId,
      seatNumbers,
    });
  }
}
