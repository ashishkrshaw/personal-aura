import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timer } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// Data models
export interface Person {
  id: number;
  name: string;
  relationship: string;
  details: string;
}
export interface Expense {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
}
export interface Reminder {
  id: number;
  text: string;
  due: string;
  notified: boolean;
}

// Backend URL is sourced from environment variables, with a fallback for local development.
const API_BASE_URL = process.env.AURA_BACKEND_URL || 'http://baddi.duckdns.org:9091';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/api`;

  backendStatus = signal<'checking' | 'online' | 'offline'>('checking');

  checkBackendStatus() {
    this.http.get<{ status: string }>(`${this.apiUrl}/health`).pipe(
      map(() => 'online' as const),
      catchError(() => of('offline' as const))
    ).subscribe(status => {
      this.backendStatus.set(status);
    });
  }

  // --- People Data ---
  getPeople(): Observable<Person[]> {
    return this.http.get<Person[]>(`${this.apiUrl}/people`).pipe(
      catchError(this.handleError<Person[]>('getPeople', []))
    );
  }

  savePeople(people: Person[]): Observable<Person[]> {
    return this.http.post<Person[]>(`${this.apiUrl}/people`, people).pipe(
      catchError(this.handleError<Person[]>('savePeople', []))
    );
  }

  // --- Finance Data (Expenses) ---
  getExpenses(): Observable<Expense[]> {
    return this.http.get<Expense[]>(`${this.apiUrl}/expenses`).pipe(
      catchError(this.handleError<Expense[]>('getExpenses', []))
    );
  }

  saveExpenses(expenses: Expense[]): Observable<Expense[]> {
    return this.http.post<Expense[]>(`${this.apiUrl}/expenses`, expenses).pipe(
      catchError(this.handleError<Expense[]>('saveExpenses', []))
    );
  }

  // --- Reminders Data ---
  getReminders(): Observable<Reminder[]> {
    return this.http.get<Reminder[]>(`${this.apiUrl}/reminders`).pipe(
      catchError(this.handleError<Reminder[]>('getReminders', []))
    );
  }

  saveReminders(reminders: Reminder[]): Observable<Reminder[]> {
    return this.http.post<Reminder[]>(`${this.apiUrl}/reminders`, reminders).pipe(
      catchError(this.handleError<Reminder[]>('saveReminders', []))
    );
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      this.backendStatus.set('offline');
      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }
}