import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranspositionService, InstrumentOption } from '../../services/transposition';

@Component({
  selector: 'app-steps',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './steps.html',
  styleUrl: './steps.css'
})
export class StepsComponent implements OnInit {
  // Variables de estado
  archivoFisico: File | null = null;
  nombreArchivo: string = '';
  instrumentoSeleccionado: InstrumentOption | null = null;
  busqueda: string = '';
  
  // Variables del proceso real
  procesando: boolean = false;
  cargandoInstrumentos: boolean = true;
  errorMessage: string = '';

  instrumentos: InstrumentOption[] = [];

  constructor(
    private transpositionService: TranspositionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.transpositionService.getInstruments().subscribe({
      next: (instruments) => {
        this.instrumentos = instruments;
        this.cargandoInstrumentos = false;
      },
      error: (error) => {
        this.cargandoInstrumentos = false;
        this.errorMessage = error.error?.message ?? 'No se pudo cargar la lista de instrumentos.';
      }
    });
  }

  get instrumentosFiltrados(): InstrumentOption[] {
    return this.instrumentos.filter(inst => 
      inst.nombre.toLowerCase().includes(this.busqueda.toLowerCase())
    );
  }

  get nombreInstrumentoSeleccionado(): string {
    return this.instrumentoSeleccionado?.nombre ?? '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.archivoFisico = file;
      this.nombreArchivo = file.name;
      this.errorMessage = '';
    }
  }

  seleccionar(inst: InstrumentOption): void {
    this.instrumentoSeleccionado = inst;
    this.errorMessage = '';
  }

  transponer(): void {
    if (!this.archivoFisico || !this.instrumentoSeleccionado) return;

    this.procesando = true;
    this.errorMessage = '';

    this.transpositionService
      .transposeScore(this.archivoFisico, this.instrumentoSeleccionado.nombre)
      .subscribe({
        next: (response) => {
          this.procesando = false;
          void this.router.navigate(['/result'], {
            queryParams: {
              file: response.download_filename,
              instrument: response.instrumento,
              name: response.nombre_archivo
            }
          });
        },
        error: (error) => {
          this.procesando = false;
          this.errorMessage = error.error?.message ?? 'No se pudo procesar la partitura.';
        }
      });
  }

  reiniciar(): void {
    this.archivoFisico = null;
    this.nombreArchivo = '';
    this.instrumentoSeleccionado = null;
    this.busqueda = '';
    this.procesando = false;
    this.errorMessage = '';
  }
}
