/** Tiny WebAudio sonification — no assets, synth tones only. */

let ctx: AudioContext | null = null;
let enabled = false;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export function isSoundEnabled() {
  return enabled;
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  opts: {
    at?: number;
    dur?: number;
    type?: OscillatorType;
    gain?: number;
    slideTo?: number;
  } = {},
) {
  const ac = audio();
  if (!ac) return;
  const { at = 0, dur = 0.18, type = "sine", gain = 0.05, slideTo } = opts;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Seismic event: lower + longer for bigger magnitudes. */
export function playQuakeTone(mag: number) {
  const f = 170 + Math.min(mag, 8.5) * 26; // M3 ≈ 250Hz → M8+ ≈ 390Hz
  tone(f, { dur: 0.32, type: "triangle", gain: 0.06, slideTo: f * 0.72 });
}

/** ISS flyover / watchlist alert chime. */
export function playAlertChime() {
  tone(660, { dur: 0.14, type: "sine", gain: 0.05 });
  tone(990, { at: 0.13, dur: 0.22, type: "sine", gain: 0.05 });
}

/** Keyboard / UI confirm blip. */
export function playUiBlip() {
  tone(520, { dur: 0.07, type: "square", gain: 0.02 });
}
