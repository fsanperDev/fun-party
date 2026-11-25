/** Envoltorios de la Web Speech API (reconocimiento y síntesis en español). */

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;

export function getRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!C) return null;
  const r = new C();
  r.lang = 'es-ES';
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  return r;
}

export function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''));
    u.lang = 'es-ES';
    window.speechSynthesis.speak(u);
  } catch {
    /* la síntesis es opcional */
  }
}

/** Canal sencillo para que la voz pida abrir paneles de la pantalla de partida. */
export const VOICE_EVENT = 'funparty:voice-panel';
export const emitPanel = (panel: 'summary' | 'rules') =>
  window.dispatchEvent(new CustomEvent(VOICE_EVENT, { detail: panel }));
