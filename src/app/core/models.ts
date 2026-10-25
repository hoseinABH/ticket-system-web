// Shapes returned by the ticket-system API

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string };
}

export interface Flight {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  basePrice: string;
  version: number;
  availableSeats?: number;
}

export interface Seat {
  seatNumber: string;
  available: boolean;
}

export interface FareQuote {
  quoteToken: string;
  quote: {
    flightId: string;
    flightNumber: string;
    seatNumbers: string[];
    totalPrice: string;
    expiresAt: number;
  };
}

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED';

export interface Booking {
  id: string;
  userId: string;
  flightId: string;
  pnr: string;
  seatCount: number;
  totalLockedPrice: string;
  status: BookingStatus;
  createdAt: string;
  cancelledAt: string | null;
  paymentId: string | null;
  seatNumbers: string[];
}

// The fake payment provider's test cards (see the backend's FakePaymentProvider)
export const TEST_CARDS = [
  { token: 'tok_visa', label: 'Visa: succeeds' },
  { token: 'tok_declined', label: 'Declined by the bank' },
  { token: 'tok_slow', label: 'Slow: charged, answer arrives too late' },
  { token: 'tok_unavailable', label: 'Provider unavailable' },
] as const;
