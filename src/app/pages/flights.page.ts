import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../core/api';
import { AuthService } from '../core/auth.service';
import { FlightsService } from '../core/flights.service';
import type { Flight } from '../core/models';

@Component({
  selector: 'app-flights-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, CurrencyPipe],
  template: `
    <h1>Find a flight</h1>
    <p class="muted">Only upcoming flights with free seats are listed.</p>

    <form class="card row" [formGroup]="form" (ngSubmit)="search()">
      <div class="field">
        <label for="origin">From</label>
        <input id="origin" formControlName="origin" maxlength="3" placeholder="THR" />
      </div>
      <div class="field">
        <label for="destination">To</label>
        <input id="destination" formControlName="destination" maxlength="3" placeholder="IST" />
      </div>
      <button type="submit" [disabled]="form.invalid || loading()">Search</button>
      <button type="button" class="ghost" (click)="seed()" [disabled]="loading()">
        Add sample flights
      </button>
    </form>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    @if (loading()) {
      <p class="muted">Searching…</p>
    } @else if (flights().length === 0) {
      <div class="card empty">
        No flights found. Try THR → IST after clicking “Add sample flights”.
      </div>
    } @else {
      @for (flight of flights(); track flight.id) {
        <div class="card flight">
          <div>
            <div class="number mono">{{ flight.flightNumber }}</div>
            <div class="route">{{ flight.origin }} → {{ flight.destination }}</div>
            <div class="muted small">{{ flight.departureTime | date: 'EEE d MMM y, HH:mm' }}</div>
          </div>
          <div class="right">
            <div class="price">{{ +flight.basePrice | currency: 'USD' }} <span class="muted small">/ seat</span></div>
            <div class="muted small">{{ flight.availableSeats }} seats left</div>
            <a class="button" [routerLink]="['/flights', flight.id]">
              {{ auth.isLoggedIn() ? 'Choose seats' : 'Sign in to book' }}
            </a>
          </div>
        </div>
      }
    }
  `,
  styles: `
    .flight { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    .number { font-weight: 700; }
    .route { font-size: 1.15rem; }
    .right { text-align: right; display: grid; gap: 6px; justify-items: end; }
    .price { font-weight: 700; font-size: 1.1rem; }
    @media (max-width: 600px) {
      .flight { flex-direction: column; align-items: stretch; }
      .right { text-align: left; justify-items: start; }
    }
  `,
})
export class FlightsPage implements OnInit {
  private readonly flightsService = inject(FlightsService);
  protected readonly auth = inject(AuthService);

  protected readonly flights = signal<Flight[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    origin: ['THR', [Validators.required, Validators.minLength(3)]],
    destination: ['IST', [Validators.required, Validators.minLength(3)]],
  });

  ngOnInit() {
    this.search();
  }

  search() {
    const { origin, destination } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.flightsService.search(origin, destination).subscribe({
      next: (flights) => {
        this.flights.set(flights);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  seed() {
    this.loading.set(true);
    this.flightsService.seed().subscribe({
      next: () => {
        this.form.setValue({ origin: 'THR', destination: 'IST' });
        this.search();
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
