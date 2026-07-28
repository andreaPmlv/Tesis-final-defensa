import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { AuthService } from '../../services/auth';

function passwordsMatchValidator(
  control: AbstractControl
): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (!password || !confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  token = '';
  isCheckingToken = true;
  isSubmitting = false;
  tokenValid = false;
  successMessage = '';
  errorMessage = '';
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.resetForm = this.fb.group(
      {
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.pattern(/^(?=.*[A-Z])(?=.*\d).+$/)
          ]
        ],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: passwordsMatchValidator }
    );
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.cdr.detectChanges();

    if (!this.token) {
      this.isCheckingToken = false;
      this.errorMessage = 'El enlace de recuperación no es válido.';
      this.cdr.detectChanges();
      return;
    }

    this.authService.validateResetToken(this.token).subscribe({
      next: () => {
        this.isCheckingToken = false;
        this.tokenValid = true;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isCheckingToken = false;
        this.tokenValid = false;
        this.errorMessage =
          error.error?.message ??
          'El enlace de recuperación no es válido o ya expiró.';
        this.cdr.detectChanges();
      }
    });
  }

  onSubmit(): void {
    if (this.resetForm.valid && this.tokenValid) {
      this.isSubmitting = true;
      this.errorMessage = '';

      this.authService
        .resetPassword(this.token, this.resetForm.get('password')?.value)
        .subscribe({
          next: (response) => {
            this.isSubmitting = false;
            this.successMessage = response.message;
            this.tokenValid = false;
            this.resetForm.disable();
            this.cdr.detectChanges();
            setTimeout(() => {
              void this.router.navigate(['/login']);
            }, 1800);
          },
          error: (error) => {
            this.isSubmitting = false;
            this.errorMessage =
              error.error?.message ??
              'No se pudo actualizar la contraseña.';
            this.cdr.detectChanges();
          }
        });
      return;
    }

    this.resetForm.markAllAsTouched();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}
