// ============================================================
// Ritmera – Wake Lock Service
// Mantiene la pantalla activa durante sesiones.
// Sólo disponible en Chrome/Edge (no iOS).
// ============================================================

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WakeLockService {
  private sentinel: WakeLockSentinel | null = null;
  readonly isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  async acquire(): Promise<void> {
    if (!this.isSupported) return;
    try {
      this.sentinel = await (navigator as Navigator & { wakeLock: WakeLock }).wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch (err) {
      console.warn('[WakeLock] No se pudo adquirir:', err);
    }
  }

  release(): void {
    this.sentinel?.release().catch(() => {});
    this.sentinel = null;
  }

  get isActive(): boolean {
    return !!this.sentinel && !this.sentinel.released;
  }
}

// Tipo mínimo para WakeLock (no en todos los lib.dom.d.ts)
interface WakeLock {
  request(type: 'screen'): Promise<WakeLockSentinel>;
}

interface WakeLockSentinel extends EventTarget {
  released: boolean;
  release(): Promise<void>;
}
