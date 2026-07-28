import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { AuthService, AuthUser } from '../../services/auth';
import { Hero } from '../hero/hero';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    Hero
  ],
  templateUrl: './about.html',
  styleUrl: './about.css'
})
export class AboutComponent {
  mostrarBloqueo: boolean = false;
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

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  irATranspositor(): void {
    if (this.currentUser) {
      this.mostrarBloqueo = false;
      void this.router.navigate(['/transposer']);
      return;
    }

    this.mostrarBloqueo = true;
    this.cdr.markForCheck();
  }
}
