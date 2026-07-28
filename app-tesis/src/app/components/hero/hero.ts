import { ChangeDetectorRef, Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, AuthUser } from '../../services/auth';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {
  currentUser: AuthUser | null = null;

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

  irAEstadisticas() {
    if (this.currentUser) {
      void this.router.navigate(['/transposer']);
      return;
    }

    const element = document.getElementById('seccion-estadisticas');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
