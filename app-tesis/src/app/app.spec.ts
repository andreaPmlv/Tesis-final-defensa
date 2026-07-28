import { Routes } from '@angular/router';
import { AboutComponent } from './components/about/about';
// Importaremos los otros cuando los creemos, por ahora deja estas listas
export const routes: Routes = [
  { path: '', redirectTo: '/about', pathMatch: 'full' },
  { path: 'about', component: AboutComponent },
  // Aquí agregaremos /register y /steps en el siguiente paso
];