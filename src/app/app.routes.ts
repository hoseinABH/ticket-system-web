import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'flights' },
  {
    path: 'login',
    title: 'Sign in · Ticket System',
    loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'flights',
    title: 'Flights · Ticket System',
    loadComponent: () =>
      import('./pages/flights.page').then((m) => m.FlightsPage),
  },
  {
    path: 'flights/:id',
    title: 'Choose seats · Ticket System',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/flight-detail.page').then((m) => m.FlightDetailPage),
  },
  {
    path: 'bookings',
    title: 'My bookings · Ticket System',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/bookings.page').then((m) => m.BookingsPage),
  },
  { path: '**', redirectTo: 'flights' },
];
