import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { AuthResponse, LoginRequest } from '../models/auth.models';
import { MemberRole } from '../models/member-role';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private accessToken = signal<string | null>(null);
  private refreshToken = signal<string | null>(null);
  currentUser = signal<{ email: string; firstName: string; lastName: string; role: string } | null>(null);

  constructor(private http: HttpClient, private router: Router) {
    const stored = localStorage.getItem('refreshToken');
    if (stored) this.refreshToken.set(stored);
  }

  register(dto: { firstName: string; lastName: string; email: string; password: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/register`, dto);
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, request)
      .pipe(
        tap(response => {
          this.accessToken.set(response.accessToken);
          this.currentUser.set({ email: response.email, firstName: response.firstName, lastName: response.lastName, role: response.role });
          if (response.refreshToken) {
            this.refreshToken.set(response.refreshToken);
            localStorage.setItem('refreshToken', response.refreshToken);
          }
        })
      );
  }

  tryAutoLogin(): Observable<boolean> {
    return this.refresh().pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  refresh(): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken: this.refreshToken() })
      .pipe(
        tap(response => {
          this.accessToken.set(response.accessToken);
          this.currentUser.set({ email: response.email, firstName: response.firstName, lastName: response.lastName, role: response.role });
          if (response.refreshToken) {
            this.refreshToken.set(response.refreshToken);
            localStorage.setItem('refreshToken', response.refreshToken);
          }
        })
      );
  }

  logout(): void {
    this.http
      .post(`${environment.apiUrl}/auth/logout`, { refreshToken: this.refreshToken() })
      .subscribe();
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.currentUser.set(null);
    localStorage.removeItem('refreshToken');
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }

  isLoggedIn(): boolean {
    return this.accessToken() !== null;
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === MemberRole.Admin;
  }
}
