import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './forgot-password.html', // Ruta corta
  styleUrl: './forgot-password.css'    // Ruta corta
})
export class ForgotPasswordComponent {
  forgotForm: FormGroup;
  mensajeEnviado: boolean = false;
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onReset(): void {
    if (this.forgotForm.valid) {
      this.isSubmitting = true;
      this.errorMessage = '';
      this.successMessage = '';

      this.authService
        .requestPasswordReset(this.forgotForm.get('email')?.value)
        .subscribe({
          next: (response) => {
            this.isSubmitting = false;
            this.mensajeEnviado = true;
            this.successMessage = response.message;
          },
          error: (error) => {
            this.isSubmitting = false;
            this.errorMessage =
              error.error?.message ??
              'No se pudo procesar la solicitud de recuperación.';
          }
        });
      return;
    }

    this.forgotForm.markAllAsTouched();
  }
}
