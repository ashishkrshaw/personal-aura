import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

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

// Backend URL is sourced from the runtime configuration, with a fallback for local development.
// This allows for flexible deployment configurations without using process.env in the browser.
const API_BASE_URL = (window as any).runtimeConfig?.AURA_BACKEND_URL || 'http://localhost:8082';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/api`;

  isMongoConfigured = signal(!!(window as any).runtimeConfig?.MONGO_URI);

  // --- People Data ---
  getPeople(): Observable<Person[]> {
    if (this.isMongoConfigured()) {
      return this.http.get<Person[]>(`${this.apiUrl}/people`).pipe(
        catchError(this.handleError<Person[]>('getPeople', []))
      );
    } else {
      const savedPeople = localStorage.getItem('aura-people');
      return of(savedPeople ? JSON.parse(savedPeople) : []);
    }
  }

  savePeople(people: Person[]): Observable<Person[]> {
    if (this.isMongoConfigured()) {
      return this.http.post<Person[]>(`${this.apiUrl}/people`, people).pipe(
        catchError(this.handleError<Person[]>('savePeople', []))
      );
    } else {
      localStorage.setItem('aura-people', JSON.stringify(people));
      return of(people);
    }
  }

  // --- Finance Data (Expenses) ---
  getExpenses(): Observable<Expense[]> {
    if (this.isMongoConfigured()) {
      return this.http.get<Expense[]>(`${this.apiUrl}/expenses`).pipe(
        catchError(this.handleError<Expense[]>('getExpenses', []))
      );
    } else {
      const savedExpenses = localStorage.getItem('aura-expenses');
      return of(savedExpenses ? JSON.parse(savedExpenses) : []);
    }
  }

  saveExpenses(expenses: Expense[]): Observable<Expense[]> {
    if (this.isMongoConfigured()) {
      return this.http.post<Expense[]>(`${this.apiUrl}/expenses`, expenses).pipe(
        catchError(this.handleError<Expense[]>('saveExpenses', []))
      );
    } else {
      localStorage.setItem('aura-expenses', JSON.stringify(expenses));
      return of(expenses);
    }
  }

  // --- Reminders Data ---
  getReminders(): Observable<Reminder[]> {
    if (this.isMongoConfigured()) {
      return this.http.get<Reminder[]>(`${this.apiUrl}/reminders`).pipe(
        catchError(this.handleError<Reminder[]>('getReminders', []))
      );
    } else {
      const savedReminders = localStorage.getItem('aura-reminders');
      return of(savedReminders ? JSON.parse(savedReminders) : []);
    }
  }

  saveReminders(reminders: Reminder[]): Observable<Reminder[]> {
    if (this.isMongoConfigured()) {
      return this.http.post<Reminder[]>(`${this.apiUrl}/reminders`, reminders).pipe(
        catchError(this.handleError<Reminder[]>('saveReminders', []))
      );
    } else {
      localStorage.setItem('aura-reminders', JSON.stringify(reminders));
      return of(reminders);
    }
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }
}