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

interface Note {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  /** silencio tras la nota (s) */
  gapAfter: number;
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
      for (const osc of this.createTone(cue, at)) this.scheduled.push({ osc, at, cue });
    }
  }

  /** Programa todas las notas de un aviso; devuelve sus osciladores para poder cancelarlos. */
  private createTone(cue: AudioCue, at: number): OscillatorNode[] {
    if (!this.ctx) return [];
    const nodes: OscillatorNode[] = [];
    try {
      let t = at;
      for (const { frequency, duration, type, gain, gapAfter } of this.cuePattern(cue)) {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, t);
        // Envolvente sostenida (ataque y caída cortos) para que suene como alarma, no como "plink".
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(gain, t + 0.005);
        gainNode.gain.setValueAtTime(gain, t + duration - 0.02);
        gainNode.gain.linearRampToValueAtTime(0, t + duration);

        osc.start(t);
        osc.stop(t + duration);
        nodes.push(osc);
        t += duration + gapAfter;
      }
    } catch (err) {
      console.warn('[AudioService] Error reproduciendo tono:', err);
    }
    return nodes;
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

  private cuePattern(cue: AudioCue): Note[] {
    const n = (frequency: number, duration: number, gapAfter = 0.05, type: OscillatorType = 'square', gain = 0.3): Note =>
      ({ frequency, duration, type, gain, gapAfter });
    switch (cue) {
      case 'start':
        // Doble tono agudo-grave ×2, tipo alarma (~0,8 s)
        return [n(1318, 0.16), n(988, 0.16), n(1318, 0.16), n(988, 0.16, 0)];
      case 'complete': {
        // Arpegio ascendente + tono largo, repetido dos veces (~2,4 s)
        const run = [n(784, 0.12), n(988, 0.12), n(1175, 0.12), n(1568, 0.45, 0.2)];
        return [...run, ...run];
      }
      case 'end':
        return [n(440, 0.3, 0, 'sine', 0.4)];
      case 'warning':
        return [n(660, 0.1, 0, 'square', 0.2)];
      case 'transition':
        return [n(587, 0.2, 0, 'triangle', 0.35)];
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
