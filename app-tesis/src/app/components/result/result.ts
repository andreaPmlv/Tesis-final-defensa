import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranspositionService } from '../../services/transposition';

declare global {
  interface Window {
    opensheetmusicdisplay?: {
      OpenSheetMusicDisplay: new (
        container: HTMLElement
      ) => {
        setOptions(options: Record<string, unknown>): void;
        load(xml: string): Promise<void>;
        render(): void;
      };
    };
  }
}

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './result.html',
  styleUrl: './result.css'
})
export class ResultComponent implements AfterViewInit {
  @ViewChild('scoreViewer') scoreViewer?: ElementRef<HTMLDivElement>;

  isLoading = true;
  errorMessage = '';
  instrument = '';
  fileName = '';
  downloadFilename = '';
  xmlContent = '';
  private renderTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private transpositionService: TranspositionService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.downloadFilename = params.get('file') ?? '';
      this.instrument = params.get('instrument') ?? '';
      this.fileName = params.get('name') ?? '';
      this.cdr.detectChanges();

      if (!this.downloadFilename || !this.instrument) {
        void this.router.navigate(['/transposer']);
        return;
      }

      this.loadProcessedScore();
    });
  }

  downloadXml(): void {
    if (!this.xmlContent || !this.downloadFilename) {
      return;
    }

    const blob = new Blob([this.xmlContent], {
      type: 'application/vnd.recordare.musicxml+xml'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.downloadFilename;
    link.click();
    URL.revokeObjectURL(url);
  }

  printScore(): void {
    const scoreMarkup = this.scoreViewer?.nativeElement.innerHTML ?? '';

    if (!scoreMarkup.trim()) {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    const printTitle =
      this.downloadFilename.replace(/\.xml$/i, '') || 'Partitura transpuesta';

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>${this.escapeHtml(printTitle)}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }

            * {
              box-sizing: border-box;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #111111;
              font-family: Georgia, "Times New Roman", serif;
            }

            body {
              padding: 0;
            }

            .print-shell {
              width: 100%;
            }

            .print-meta {
              margin: 0 0 4mm;
              color: #7a7a7a;
              font-size: 10px;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }

            .score-sheet {
              width: 100%;
              overflow: visible;
            }

            .score-sheet svg {
              width: 100% !important;
              height: auto !important;
              display: block;
            }
          </style>
        </head>
        <body>
          <main class="print-shell">
            <p class="print-meta">${this.escapeHtml(printTitle)}</p>
            <section class="score-sheet">
              ${scoreMarkup}
            </section>
          </main>
        </body>
      </html>
    `);
    printWindow.document.close();

    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }

  private loadProcessedScore(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.clearRenderTimeout();
    this.clearViewer();

    this.transpositionService.getProcessedScore(this.downloadFilename).subscribe({
      next: (xmlContent) => {
        this.xmlContent = xmlContent;
        this.cdr.detectChanges();
        setTimeout(() => this.renderScore(), 0);
      },
      error: (error) => {
        this.zone.run(() => {
          this.isLoading = false;
          this.errorMessage =
            error.error?.message ??
            'No se pudo cargar la partitura procesada.';
          this.cdr.detectChanges();
        });
      }
    });
  }

  private renderScore(): void {
    const viewer = this.scoreViewer?.nativeElement;
    const osmdLibrary = window.opensheetmusicdisplay;

    if (!viewer || !this.xmlContent) {
      this.zone.run(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      });
      return;
    }

    if (!osmdLibrary?.OpenSheetMusicDisplay) {
      this.zone.run(() => {
        this.isLoading = false;
        this.errorMessage = 'No se pudo cargar el visor de partituras.';
        this.cdr.detectChanges();
      });
      return;
    }

    viewer.innerHTML = '';

    const osmd = new osmdLibrary.OpenSheetMusicDisplay(viewer);
    osmd.setOptions({
      autoResize: true,
      drawTitle: true,
      backend: 'svg'
    });

    this.renderTimeoutId = setTimeout(() => {
      this.zone.run(() => {
        this.isLoading = false;
        this.errorMessage =
          'La partitura tardó demasiado en renderizarse. Intenta otra vez.';
        this.cdr.detectChanges();
      });
    }, 15000);

    osmd
      .load(this.xmlContent)
      .then(() => {
        osmd.render();
        this.zone.run(() => {
          this.clearRenderTimeout();
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      })
      .catch(() => {
        this.zone.run(() => {
          this.clearRenderTimeout();
          this.isLoading = false;
          this.errorMessage =
            'La partitura se procesó, pero no se pudo visualizar.';
          this.cdr.detectChanges();
        });
      });
  }

  private clearViewer(): void {
    if (this.scoreViewer?.nativeElement) {
      this.scoreViewer.nativeElement.innerHTML = '';
    }
  }

  private clearRenderTimeout(): void {
    if (this.renderTimeoutId) {
      clearTimeout(this.renderTimeoutId);
      this.renderTimeoutId = undefined;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
