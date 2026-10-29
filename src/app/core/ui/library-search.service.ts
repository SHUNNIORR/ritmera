import { Injectable, signal } from '@angular/core';

/**
 * Estado compartido de búsqueda de la biblioteca.
 * Vive en la cabecera global (`AppComponent`) y lo consume la biblioteca.
 */
@Injectable({ providedIn: 'root' })
export class LibrarySearchService {
  private readonly _query = signal('');

  /** Texto de búsqueda actual. */
  readonly query = this._query.asReadonly();

  setQuery(value: string): void {
    this._query.set(value);
  }

  clear(): void {
    this._query.set('');
  }
}
