import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Importación de componentes principales
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  // Aquí declaramos todo lo que el HTML va a usar
  imports: [
    CommonModule, 
    RouterModule, 
    Navbar, 
    Footer
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit {
  title = 'app-tesis';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.loadSession().subscribe();
  }
}
