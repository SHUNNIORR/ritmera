// ============================================================
// Intervala – Audio Service (Web Audio API)
// Genera tonos localmente, funciona offline.
// ============================================================

import { Injectable } from '@angular/core';

export type AudioCue = 'start' | 'end' | 'warning' | 'complete' | 'transition';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private ctx: AudioContext | null = null;
  private enabled = true;

  /** Debe llamarse en respuesta a un gesto del usuario */
  initContext(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  async play(cue: AudioCue): Promise<void> {
    if (!this.enabled || !this.ctx) return;

    const { frequency, duration, type, gain } = this.cueParams(cue);
    await this.playTone(frequency, duration, type, gain);
  }

  private async playTone(
    frequency: number,
    durationSec: number,
    type: OscillatorType,
    gainValue: number
  ): Promise<void> {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      gainNode.gain.setValueAtTime(gainValue, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + durationSec);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + durationSec);
    } catch (err) {
      console.warn('[AudioService] Error reproduciendo tono:', err);
    }
  }

  private cueParams(cue: AudioCue): {
    frequency: number;
    duration: number;
    type: OscillatorType;
    gain: number;
  } {
    switch (cue) {
      case 'start':
        return { frequency: 880, duration: 0.15, type: 'sine', gain: 0.4 };
      case 'end':
        return { frequency: 440, duration: 0.3, type: 'sine', gain: 0.4 };
      case 'warning':
        return { frequency: 660, duration: 0.1, type: 'square', gain: 0.2 };
      case 'complete':
        return { frequency: 1046, duration: 0.5, type: 'sine', gain: 0.5 };
      case 'transition':
        return { frequency: 587, duration: 0.2, type: 'triangle', gain: 0.35 };
    }
  }

  dispose(): void {
    this.ctx?.close();
    this.ctx = null;
  }
}
