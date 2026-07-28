import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { API_BASE_URL } from './api-config';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_blocked: boolean;
}

export interface AdminDashboardUser extends AuthUser {
  total_scores: number;
}

export interface AdminDashboardResponse {
  total_users: number;
  total_scores: number;
  users: AdminDashboardUser[];
}

interface AuthResponse {
  message: string;
  user: AuthUser;
}

interface MessageResponse {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  register(payload: {
    username: string;
    email: string;
    password: string;
  }): Observable<{ message: string; user: AuthUser }> {
    return this.http.post<{ message: string; user: AuthUser }>(
      `${API_BASE_URL}/register`,
      payload,
      { withCredentials: true }
    );
  }

  login(payload: { email: string; password: string }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/login`, payload, {
        withCredentials: true
      })
      .pipe(
        tap((response) => {
          this.currentUserSubject.next(response.user);
        })
      );
  }

  loadSession(): Observable<AuthUser | null> {
    return this.http
      .get<{ user: AuthUser }>(`${API_BASE_URL}/me`, { withCredentials: true })
      .pipe(
        tap((response) => {
          this.currentUserSubject.next(response.user);
        }),
        map((response) => response.user),
        catchError(() => {
          this.currentUserSubject.next(null);
          return of(null);
        })
      );
  }

  logout(): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(
        `${API_BASE_URL}/logout`,
        {},
        { withCredentials: true }
      )
      .pipe(
        tap(() => {
          this.currentUserSubject.next(null);
        }),
        catchError((error) => {
          this.currentUserSubject.next(null);
          return throwError(() => error);
        })
      );
  }

  clearSession(): void {
    this.currentUserSubject.next(null);
  }

  requestPasswordReset(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${API_BASE_URL}/forgot-password`, {
      email
    });
  }

  validateResetToken(token: string): Observable<MessageResponse> {
    return this.http.get<MessageResponse>(
      `${API_BASE_URL}/reset-password/${token}/validate`
    );
  }

  resetPassword(token: string, password: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${API_BASE_URL}/reset-password/${token}`,
      { password }
    );
  }

  getAdminDashboard(): Observable<AdminDashboardResponse> {
    return this.http.get<AdminDashboardResponse>(
      `${API_BASE_URL}/admin/dashboard`,
      { withCredentials: true }
    );
  }

  updateUserBlockStatus(
    userId: number,
    is_blocked: boolean
  ): Observable<{ message: string; user: AdminDashboardUser }> {
    return this.http.patch<{ message: string; user: AdminDashboardUser }>(
      `${API_BASE_URL}/admin/users/${userId}/block`,
      { is_blocked },
      { withCredentials: true }
    );
  }
}
