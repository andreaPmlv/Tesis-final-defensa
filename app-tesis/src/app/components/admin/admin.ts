import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  AdminDashboardUser,
  AuthService,
  AuthUser
} from '../../services/auth';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  currentUser: AuthUser | null = null;
  users: AdminDashboardUser[] = [];
  totalUsers = 0;
  totalScores = 0;
  loading = true;
  errorMessage = '';
  infoMessage = '';
  updatingUserId: number | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.authService.getAdminDashboard().subscribe({
      next: (response) => {
        this.users = response.users;
        this.totalUsers = response.total_users;
        this.totalScores = response.total_scores;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;

        if (error.status === 401) {
          this.router.navigate(['/login']);
          return;
        }

        this.errorMessage =
          error.status === 403
            ? 'No tienes permisos para ver esta sección.'
            : 'No se pudieron cargar los datos del panel.';
        this.cdr.markForCheck();
      }
    });
  }

  toggleUserRestriction(user: AdminDashboardUser): void {
    if (this.updatingUserId || user.id === this.currentUser?.id) {
      return;
    }

    this.updatingUserId = user.id;
    this.errorMessage = '';
    this.infoMessage = '';

    this.authService.updateUserBlockStatus(user.id, !user.is_blocked).subscribe({
      next: (response) => {
        this.users = this.users.map((listedUser) =>
          listedUser.id === response.user.id ? response.user : listedUser
        );
        this.infoMessage = response.message;
        this.updatingUserId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage =
          error.error?.message ?? 'No se pudo actualizar el acceso del usuario.';
        this.updatingUserId = null;
        this.cdr.markForCheck();
      }
    });
  }
}
