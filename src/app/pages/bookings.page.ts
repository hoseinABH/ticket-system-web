import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../core/api';
import { BookingsService } from '../core/bookings.service';
import type { Booking } from '../core/models';

const LABELS: Record<Booking['status'], string> = {
  PENDING_PAYMENT: 'Payment pending',
  CONFIRMED: 'Confirmed',
  PAYMENT_FAILED: 'Payment failed',
  CANCELLED: 'Cancelled',
};

@Component({
  selector: 'app-bookings-page',
  imports: [RouterLink, DatePipe, CurrencyPipe],
  template: `
    <div class="head">
      <div>
        <h1>My bookings</h1>
        <p class="muted">Newest first.</p>
      </div>
      <button class="ghost" (click)="load()" [disabled]="loading()">Refresh</button>
    </div>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (notice()) {
      <div class="alert ok">{{ notice() }}</div>
    }

    @for (b of bookings(); track b.id) {
      <div class="card booking">
        <div>
          <div>
            <span class="mono pnr">{{ b.pnr }}</span>
            <span class="badge" [class]="b.status">{{ labels[b.status] }}</span>
          </div>
          <div class="muted small">
            Booked {{ b.createdAt | date: 'd MMM y, HH:mm' }}
            @if (b.cancelledAt) {
              · cancelled {{ b.cancelledAt | date: 'd MMM y, HH:mm' }}
            }
          </div>
          <div class="small">
            Seats:
            {{ b.seatNumbers.length ? b.seatNumbers.join(', ') : 'released' }}
            · {{ +b.totalLockedPrice | currency: 'USD' }}
          </div>
          @if (b.status === 'PENDING_PAYMENT') {
            <div class="muted small">Checking with the payment provider…</div>
          }
        </div>
        @if (b.status === 'CONFIRMED') {
          <button class="danger" (click)="cancel(b)" [disabled]="cancelling() === b.id">
            {{ cancelling() === b.id ? 'Cancelling…' : 'Cancel' }}
          </button>
        }
      </div>
    } @empty {
      @if (!loading()) {
        <div class="card empty">
          No bookings yet. <a routerLink="/flights">Find a flight</a>.
        </div>
      }
    }
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .booking { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    .pnr { font-weight: 700; font-size: 1.1rem; margin-right: 8px; }
  `,
})
export class BookingsPage implements OnInit {
  private readonly bookingsService = inject(BookingsService);

  protected readonly labels = LABELS;
  protected readonly bookings = signal<Booking[]>([]);
  protected readonly loading = signal(false);
  protected readonly cancelling = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  private refreshTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.refreshTimer));
  }

  ngOnInit() {
    this.load();
  }

  load() {
    clearTimeout(this.refreshTimer);
    this.loading.set(true);
    this.bookingsService.myBookings().subscribe({
      next: (bookings) => {
        this.bookings.set(bookings);
        this.loading.set(false);
        // While a payment is unsettled, check back until the reconciler
        // has confirmed or failed it
        if (bookings.some((b) => b.status === 'PENDING_PAYMENT')) {
          this.refreshTimer = setTimeout(() => this.load(), 3000);
        }
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  cancel(booking: Booking) {
    if (!confirm(`Cancel booking ${booking.pnr}? Its seats will be released.`)) {
      return;
    }
    this.cancelling.set(booking.id);
    this.error.set(null);
    this.bookingsService.cancel(booking.id).subscribe({
      next: () => {
        this.notice.set(`Booking ${booking.pnr} cancelled.`);
        this.cancelling.set(null);
        this.load();
      },
      error: (e: unknown) => {
        this.error.set(errorMessage(e));
        this.cancelling.set(null);
      },
    });
  }
}
