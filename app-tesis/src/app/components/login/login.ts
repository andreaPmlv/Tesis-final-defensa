import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage = '';
  isSubmitting = false;
  showPassword = false;
  showRestrictedModal = false;
  restrictedMessage = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  onLogin(): void {
    if (this.loginForm.valid) {
      this.errorMessage = '';
      this.showRestrictedModal = false;
      this.restrictedMessage = '';
      this.isSubmitting = true;

      this.authService.login(this.loginForm.getRawValue()).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.cdr.markForCheck();
          this.router.navigate(['/transposer']);
        },
        error: (error) => {
          this.isSubmitting = false;
          const message =
            error.error?.message ?? 'No se pudo iniciar sesión.';

          if (error.status === 403) {
            this.restrictedMessage = message;
            this.showRestrictedModal = true;
            this.errorMessage = '';
            this.cdr.markForCheck();
            return;
          }

          this.errorMessage = message;
          this.cdr.markForCheck();
        }
      });
      return;
    }

    this.loginForm.markAllAsTouched();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  closeRestrictedModal(): void {
    this.showRestrictedModal = false;
    this.restrictedMessage = '';
    this.cdr.markForCheck();
  }
}
