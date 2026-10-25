import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../core/api';
import { BookingsService } from '../core/bookings.service';
import { FlightsService } from '../core/flights.service';
import {
  TEST_CARDS,
  type Booking,
  type FareQuote,
  type Flight,
  type Seat,
} from '../core/models';

type Phase = 'choosing' | 'quoted' | 'paying' | 'pending' | 'confirmed' | 'failed';

interface Attempt {
  n: number;
  status: number;
  replayed: boolean;
  outcome: string;
}

const MAX_SEATS = 9;
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30;

@Component({
  selector: 'app-flight-detail-page',
  imports: [RouterLink, FormsModule, DatePipe, CurrencyPipe],
  template: `
    <a routerLink="/flights" class="muted small">← Back to flights</a>

    @if (flight(); as f) {
      <h1>{{ f.flightNumber }} · {{ f.origin }} → {{ f.destination }}</h1>
      <p class="muted">
        {{ f.departureTime | date: 'EEEE d MMMM y, HH:mm' }} ·
        {{ +f.basePrice | currency: 'USD' }} per seat
      </p>
    }

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    <div class="layout">
      <section class="card">
        <h2>1. Choose seats</h2>
        <div class="legend small muted">
          <span><i class="dot free"></i> Free</span>
          <span><i class="dot picked"></i> Selected</span>
          <span><i class="dot taken"></i> Taken</span>
        </div>

        <div class="cabin">
          @for (row of rows(); track row.number) {
            <div class="seat-row">
              <span class="row-number muted small">{{ row.number }}</span>
              @for (seat of row.seats; track seat.seatNumber; let i = $index) {
                @if (i === 3) {
                  <span class="aisle"></span>
                }
                <button
                  class="seat"
                  [class.taken]="!seat.available"
                  [class.picked]="isSelected(seat.seatNumber)"
                  [disabled]="!seat.available || phase() !== 'choosing'"
                  [attr.aria-pressed]="isSelected(seat.seatNumber)"
                  [title]="seat.seatNumber"
                  (click)="toggle(seat)"
                >
                  {{ seat.seatNumber.slice(-1) }}
                </button>
              }
            </div>
          } @empty {
            <p class="muted">Loading seat map…</p>
          }
        </div>
      </section>

      <aside>
        <section class="card">
          <h2>2. Price</h2>
          @if (phase() === 'choosing') {
            <p class="muted">
              {{ selected().length ? 'Seats: ' + selected().join(', ') : 'Pick up to 9 seats.' }}
            </p>
            <button [disabled]="!selected().length || busy()" (click)="getQuote()">
              Get price
            </button>
          } @else if (quote(); as q) {
            <p>
              Seats <strong>{{ q.quote.seatNumbers.join(', ') }}</strong><br />
              Total <strong>{{ +q.quote.totalPrice | currency: 'USD' }}</strong>
            </p>
            <p class="muted small">
              Price locked until {{ q.quote.expiresAt | date: 'HH:mm' }}
            </p>
            @if (phase() === 'quoted') {
              <button class="ghost" (click)="restart()">Change seats</button>
            }
          }
        </section>

        <section class="card">
          <h2>3. Pay</h2>
          @switch (phase()) {
            @case ('quoted') {
              <label for="card">Test card</label>
              <select id="card" [(ngModel)]="card">
                @for (c of cards; track c.token) {
                  <option [value]="c.token">{{ c.label }}</option>
                }
              </select>
              <button class="pay" (click)="pay()">Pay {{ +quote()!.quote.totalPrice | currency: 'USD' }}</button>
            }
            @case ('paying') {
              <div class="alert info">Charging your card…</div>
            }
            @case ('pending') {
              <div class="alert warn">
                The payment provider did not answer in time, so we don't know yet
                whether the charge went through. Your seats are held while we
                check (attempt {{ attempts().length }}).
              </div>
            }
            @case ('confirmed') {
              <div class="alert ok">
                Booked! PNR <strong class="mono">{{ booking()?.pnr }}</strong>,
                seats {{ booking()?.seatNumbers?.join(', ') }}.
              </div>
              <a class="button" routerLink="/bookings">See my bookings</a>
              <button class="ghost" (click)="restart()">Book more</button>
            }
            @case ('failed') {
              <div class="alert error">{{ failure() }}</div>
              <button (click)="restart()">Try again</button>
            }
            @default {
              <p class="muted">Get a price first.</p>
            }
          }
        </section>

        @if (key()) {
          <section class="card under-the-hood">
            <h2>Under the hood</h2>
            <p class="small muted">
              One <span class="mono">Idempotency-Key</span> per purchase, reused on
              every retry, so the server can never book or charge twice.
            </p>
            <p class="small mono key">{{ key() }}</p>
            <ol class="small">
              @for (a of attempts(); track a.n) {
                <li>
                  <span class="mono">HTTP {{ a.status }}</span> {{ a.outcome }}
                  @if (a.replayed) {
                    <span class="badge PENDING_PAYMENT">replayed</span>
                  }
                </li>
              }
            </ol>
          </section>
        }
      </aside>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; align-items: start; margin-top: 16px; }
    @media (max-width: 760px) { .layout { grid-template-columns: 1fr; } }
    .legend { display: flex; gap: 16px; margin-bottom: 12px; }
    .dot { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; }
    .dot.free { border: 1px solid var(--border); background: var(--surface); }
    .dot.picked { background: var(--accent); }
    .dot.taken { background: var(--seat-taken); }
    .cabin { display: grid; gap: 6px; justify-content: center; }
    .seat-row { display: flex; gap: 6px; align-items: center; }
    .row-number { width: 24px; text-align: right; }
    .aisle { width: 18px; }
    .seat {
      width: 38px; height: 38px; padding: 0; border-radius: 8px 8px 4px 4px;
      background: var(--surface); color: var(--text); border: 1px solid var(--border); font-weight: 500;
    }
    .seat.picked { background: var(--accent); border-color: var(--accent); color: #fff; }
    .seat.taken { background: var(--seat-taken); border-color: var(--seat-taken); color: transparent; }
    .seat:disabled { opacity: 1; }
    aside .card button, aside .card .button { width: 100%; margin-top: 8px; }
    .pay { margin-top: 12px; }
    .key { word-break: break-all; background: var(--bg); padding: 6px 8px; border-radius: 6px; }
    ol { padding-left: 20px; margin: 8px 0 0; }
  `,
})
export class FlightDetailPage implements OnInit {
  private readonly flightsService = inject(FlightsService);
  private readonly bookingsService = inject(BookingsService);

  // Bound from the :id route parameter
  readonly id = input.required<string>();

  protected readonly cards = TEST_CARDS;
  protected readonly flight = signal<Flight | null>(null);
  protected readonly seats = signal<Seat[]>([]);
  protected readonly selected = signal<string[]>([]);
  protected readonly quote = signal<FareQuote | null>(null);
  protected readonly phase = signal<Phase>('choosing');
  protected readonly booking = signal<Booking | null>(null);
  protected readonly attempts = signal<Attempt[]>([]);
  protected readonly key = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);
  protected card: string = TEST_CARDS[0].token;

  private pollTimer?: ReturnType<typeof setTimeout>;

  // Seats grouped into cabin rows, e.g. { number: 12, seats: [12A … 12F] }
  protected readonly rows = computed(() => {
    const byRow = new Map<number, Seat[]>();
    for (const seat of this.seats()) {
      const row = Number(seat.seatNumber.slice(0, -1));
      byRow.set(row, [...(byRow.get(row) ?? []), seat]);
    }
    return [...byRow.entries()]
      .sort(([a], [b]) => a - b)
      .map(([number, seats]) => ({ number, seats }));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.pollTimer));
  }

  ngOnInit() {
    this.flightsService.getFlight(this.id()).subscribe({
      next: (flight) => this.flight.set(flight),
      error: (e: unknown) => this.error.set(errorMessage(e)),
    });
    this.loadSeats();
  }

  protected isSelected(seatNumber: string) {
    return this.selected().includes(seatNumber);
  }

  protected toggle(seat: Seat) {
    this.selected.update((current) =>
      current.includes(seat.seatNumber)
        ? current.filter((s) => s !== seat.seatNumber)
        : current.length < MAX_SEATS
          ? [...current, seat.seatNumber]
          : current,
    );
  }

  protected getQuote() {
    this.busy.set(true);
    this.error.set(null);
    this.flightsService.quote(this.id(), this.selected()).subscribe({
      next: (quote) => {
        this.quote.set(quote);
        this.phase.set('quoted');
        this.busy.set(false);
      },
      error: (e: unknown) => {
        // Usually 409: someone else took a seat since the map was loaded
        this.error.set(errorMessage(e));
        this.busy.set(false);
        this.selected.set([]);
        this.loadSeats();
      },
    });
  }

  protected pay() {
    // A new key per purchase. Every retry below reuses it, which is what
    // lets the server recognise the retry instead of booking again.
    this.key.set(crypto.randomUUID());
    this.attempts.set([]);
    this.phase.set('paying');
    this.sendCheckout();
  }

  // Resets the purchase. A new attempt gets a new Idempotency-Key.
  protected restart() {
    clearTimeout(this.pollTimer);
    this.selected.set([]);
    this.quote.set(null);
    this.booking.set(null);
    this.key.set(null);
    this.attempts.set([]);
    this.error.set(null);
    this.failure.set(null);
    this.phase.set('choosing');
    this.loadSeats();
  }

  private sendCheckout() {
    const quote = this.quote()!;
    this.bookingsService
      .checkout(quote.quoteToken, this.card, this.key()!)
      .subscribe({
        next: (res) => this.onCheckoutResponse(res),
        error: (e: unknown) => this.onCheckoutError(e),
      });
  }

  private onCheckoutResponse(res: HttpResponse<Booking>) {
    const booking = res.body!;
    this.record(res.status, res.headers.get('Idempotent-Replayed') === 'true', booking.status);
    this.booking.set(booking);

    if (res.status === 202) {
      // Outcome unknown: ask again with the same key. The server replays the
      // booking's current state, so this is safe to repeat.
      this.phase.set('pending');
      if (this.attempts().length < MAX_POLLS) {
        this.pollTimer = setTimeout(() => this.sendCheckout(), POLL_INTERVAL_MS);
      }
      return;
    }
    this.phase.set('confirmed');
    this.loadSeats();
  }

  private onCheckoutError(e: unknown) {
    const status = e instanceof HttpErrorResponse ? e.status : 0;
    const replayed =
      e instanceof HttpErrorResponse &&
      e.headers.get('Idempotent-Replayed') === 'true';
    this.record(status, replayed, status === 402 ? 'PAYMENT_FAILED' : 'error');

    if (status === 402) {
      // Declined: the backend released the held seats (saga compensation)
      this.failure.set(errorMessage(e));
      this.phase.set('failed');
    } else {
      this.error.set(errorMessage(e));
      this.quote.set(null);
      this.key.set(null);
      this.selected.set([]);
      this.phase.set('choosing');
    }
    this.loadSeats();
  }

  private record(status: number, replayed: boolean, outcome: string) {
    this.attempts.update((list) => [
      ...list,
      { n: list.length + 1, status, replayed, outcome },
    ]);
  }

  private loadSeats() {
    this.flightsService.getSeatMap(this.id()).subscribe({
      next: (seats) => {
        this.seats.set(seats);
        // Drop selections that someone else has taken meanwhile
        const free = new Set(seats.filter((s) => s.available).map((s) => s.seatNumber));
        this.selected.update((current) => current.filter((s) => free.has(s)));
      },
      error: (e: unknown) => this.error.set(errorMessage(e)),
    });
  }
}
