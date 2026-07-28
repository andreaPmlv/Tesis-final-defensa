import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';

export interface InstrumentOption {
  nombre: string;
  familia: string;
  clave?: string;
}

export interface TranspositionResponse {
  instrumento: string;
  nombre_archivo: string;
  download_filename: string;
}

@Injectable({
  providedIn: 'root'
})
export class TranspositionService {
  constructor(private http: HttpClient) {}

  getInstruments(): Observable<InstrumentOption[]> {
    return this.http
      .get<{ instruments: InstrumentOption[] }>(`${API_BASE_URL}/instruments`, {
        withCredentials: true
      })
      .pipe(map((response) => response.instruments));
  }

  getProcessedScore(filename: string): Observable<string> {
    return this.http.get(
      `${API_BASE_URL}/processed/${encodeURIComponent(filename)}`,
      {
        responseType: 'text',
        withCredentials: true
      }
    );
  }

  transposeScore(
    file: File,
    instrumento: string
  ): Observable<TranspositionResponse> {
    const formData = new FormData();
    formData.append('archivo_partitura', file);
    formData.append('instrumento', instrumento);

    return this.http.post<TranspositionResponse>(`${API_BASE_URL}/upload`, formData, {
      withCredentials: true
    });
  }
}
