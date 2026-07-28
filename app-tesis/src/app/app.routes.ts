import { Routes } from '@angular/router';
import { AboutComponent } from './components/about/about';
import { RegisterComponent } from './components/register/register';
import { LoginComponent } from './components/login/login';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password';
import { StepsComponent } from './components/steps/steps';
import { ResultComponent } from './components/result/result';
import { ResetPasswordComponent } from './components/reset-password/reset-password';
import { Admin } from './components/admin/admin';

export const routes: Routes = [
  { path: '', component: AboutComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password/:token', component: ResetPasswordComponent },
  { path: 'transposer', component: StepsComponent },
  { path: 'result', component: ResultComponent },
  { path: 'admin', component: Admin },
  { path: '**', redirectTo: '' }
];
