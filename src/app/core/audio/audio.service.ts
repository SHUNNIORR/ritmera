// ============================================================
// Ritmera – Audio Service (Web Audio API)
// Genera tonos localmente, funciona offline.
//
// Segundo plano: el navegador congela el JS con la pantalla
// bloqueada, así que los tonos de cada cambio de etapa se
// programan por adelantado en el reloj del AudioContext
// (osc.start(t)). Un <audio> silencioso en bucle mantiene viva
// la sesión de audio del sistema (iOS) mientras se ejecuta.
// ============================================================

import { Injectable } from '@angular/core';
import { TimerSession } from '../timer-engine/timer-engine.types';

export type AudioCue = 'start' | 'end' | 'warning' | 'complete' | 'transition';

export interface ScheduledCue {
  /** epoch ms en que debe sonar */
  atMs: number;
  cue: AudioCue;
}

/** Tonos futuros de una sesión en marcha: inicio de cada etapa siguiente y fin de sesión. */
export function buildCueTimeline(session: TimerSession, now: number): ScheduledCue[] {
  if (session.state !== 'running' || !session.stepDeadlineAt) return [];
  const cues: ScheduledCue[] = [];
  let t = session.stepDeadlineAt;
  for (let i = session.currentStepGlobalIndex + 1; i < session.expandedSteps.length; i++) {
    cues.push({ atMs: t, cue: 'start' });
    t += session.expandedSteps[i].step.durationSeconds * 1000;
  }
  cues.push({ atMs: t, cue: 'complete' });
  return cues.filter(c => c.atMs > now);
}

interface ScheduledNode {
  osc: OscillatorNode;
  /** tiempo en el reloj del AudioContext (s) */
  at: number;
  cue: AudioCue;
}

@Injectable({ providedIn: 'root' })
export class AudioService {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private scheduled: ScheduledNode[] = [];
  private lastSession: TimerSession | null = null;
  private keepAlive: HTMLAudioElement | null = null;
  private unlockListener: (() => void) | null = null;

  /** Debe llamarse en respuesta a un gesto del usuario */
  initContext(): void {
    if (!this.ctx) {
      // iOS 16.4+: 'playback' permite sonar con la pantalla bloqueada y el interruptor de silencio.
      const audioSession = (navigator as any).audioSession;
      if (audioSession) audioSession.type = 'playback';
      this.ctx = new AudioContext();
    }
    if (this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {});
    }
    if (this.lastSession?.state === 'running') this.startKeepAlive();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.lastSession) this.syncSchedule(this.lastSession);
  }

  async play(cue: AudioCue): Promise<void> {
    if (!this.enabled || !this.ctx) return;
    // Ya sonó (o va a sonar) programado para este instante: evitar doble pitido.
    const now = this.ctx.currentTime;
    if (this.scheduled.some(s => s.cue === cue && Math.abs(s.at - now) < 0.9)) return;

    this.createTone(cue, now);
  }

  /**
   * Reprograma los tonos futuros según el estado actual de la sesión.
   * Llamar en cada cambio de sesión (inicio, pausa, salto, ajuste, recuperación).
   */
  syncSchedule(session: TimerSession | null): void {
    this.lastSession = session;
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});

    const ctxNow = this.ctx.currentTime;
    // Cancelar solo lo que aún no ha empezado; lo que ya suena termina normal.
    for (const s of this.scheduled) {
      if (s.at > ctxNow) {
        try { s.osc.stop(); } catch { /* ya detenido */ }
      }
    }
    this.scheduled = this.scheduled.filter(s => s.at <= ctxNow && s.at > ctxNow - 2);

    if (session?.state === 'running') {
      this.startKeepAlive();
    } else {
      this.stopKeepAlive();
    }

    if (!session || !this.enabled) return;
    const now = Date.now();
    for (const { atMs, cue } of buildCueTimeline(session, now)) {
      const at = ctxNow + (atMs - now) / 1000;
      const osc = this.createTone(cue, at);
      if (osc) this.scheduled.push({ osc, at, cue });
    }
  }

  private createTone(cue: AudioCue, at: number): OscillatorNode | null {
    if (!this.ctx) return null;
    const { frequency, duration, type, gain } = this.cueParams(cue);
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, at);
      gainNode.gain.setValueAtTime(gain, at);
      gainNode.gain.exponentialRampToValueAtTime(0.001, at + duration);

      osc.start(at);
      osc.stop(at + duration);
      return osc;
    } catch (err) {
      console.warn('[AudioService] Error reproduciendo tono:', err);
      return null;
    }
  }

  private startKeepAlive(): void {
    if (!this.keepAlive) {
      this.keepAlive = new Audio(silentWavUrl());
      this.keepAlive.loop = true;
      this.keepAlive.setAttribute('playsinline', '');
    }
    if (!this.keepAlive.paused) return;
    this.keepAlive.play().catch(() => {
      // Sin gesto del usuario iOS rechaza play(): reintentar en el próximo toque.
      if (this.unlockListener) return;
      this.unlockListener = () => {
        document.removeEventListener('touchend', this.unlockListener!);
        document.removeEventListener('click', this.unlockListener!);
        this.unlockListener = null;
        this.initContext();
      };
      document.addEventListener('touchend', this.unlockListener);
      document.addEventListener('click', this.unlockListener);
    });
  }

  private stopKeepAlive(): void {
    this.keepAlive?.pause();
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
    this.syncSchedule(null);
    this.ctx?.close();
    this.ctx = null;
  }
}

let silentUrl: string | null = null;
/** 1 s de silencio WAV (8 kHz, 8 bits, mono) generado en memoria. */
function silentWavUrl(): string {
  if (silentUrl) return silentUrl;
  const samples = 8000;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + samples, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, samples, true);
  new Uint8Array(buf, 44).fill(128); // 128 = silencio en PCM de 8 bits
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silentUrl;
}
