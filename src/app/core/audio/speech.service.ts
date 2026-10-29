// ============================================================
// Ritmera – Speech Service (SpeechSynthesis API)
// Degradación elegante cuando no está disponible.
// ============================================================

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SpeechService {
  private enabled = false;
  private available = false;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.available = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (this.available) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  get isAvailable(): boolean {
    return this.available;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled && this.available;
  }

  speak(text: string): void {
    if (!this.enabled || !this.available || !text.trim()) return;

    try {
      // Cancelar cualquier anuncio en curso para evitar solapamiento
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voice = this.getBestVoice();
      if (voice) utterance.voice = voice;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[SpeechService] Error al hablar:', err);
    }
  }

  cancel(): void {
    if (this.available) {
      window.speechSynthesis.cancel();
    }
  }

  private loadVoices(): void {
    if (this.available) {
      this.voices = window.speechSynthesis.getVoices();
    }
  }

  private getBestVoice(): SpeechSynthesisVoice | null {
    // Preferir voz española local
    const esLocal = this.voices.find(v => v.lang.startsWith('es') && v.localService);
    if (esLocal) return esLocal;
    const es = this.voices.find(v => v.lang.startsWith('es'));
    if (es) return es;
    return null;
  }
}
