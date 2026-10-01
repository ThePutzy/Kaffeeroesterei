// A handful of sounds made on the spot with Web Audio: no sound files, no
// requests. Browsers only allow audio after a tap, so unlock() is called from
// the first pointer or key event. Whether the sound is muted is the caller's
// to keep (step 2 of the plan stores it with the save).

export function createAudio({ muted: startMuted = false } = {}) {
  let ctx = null;
  let master = null;
  let noise = null;
  let muted = startMuted;
  const lastPlayed = new Map();

  // Also called on later taps: iOS suspends or interrupts the context when
  // the app goes to the background, and only a tap or click may resume it.
  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') ctx.resume().catch(() => {});
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      ctx = new AudioContext();
    } catch {
      ctx = null;
      return;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  function setMuted(value) {
    muted = value;
    if (master) master.gain.setTargetAtTime(value ? 0 : 0.55, ctx.currentTime, 0.02);
  }

  function envelope(gainNode, at, peak, attack, decay) {
    gainNode.gain.setValueAtTime(0.0001, at);
    gainNode.gain.exponentialRampToValueAtTime(peak, at + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  }

  function hiss({ at = 0, freq = 1500, q = 1, type = 'bandpass', gain = 0.2, attack = 0.002, decay = 0.08 }) {
    const start = ctx.currentTime + at;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    envelope(g, start, gain, attack, decay);
    source.connect(filter).connect(g).connect(master);
    source.start(start, Math.random() * 0.5);
    source.stop(start + attack + decay + 0.05);
  }

  function tone({ at = 0, freq = 880, type = 'sine', gain = 0.15, attack = 0.004, decay = 0.2, slide = 0 }) {
    const start = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, start + attack + decay);
    const g = ctx.createGain();
    envelope(g, start, gain, attack, decay);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + attack + decay + 0.05);
  }

  const vary = (value, amount = 0.06) => value * (1 + (Math.random() - 0.5) * 2 * amount);

  const SOUNDS = {
    stir: () => hiss({ freq: vary(1300, 0.2), q: 0.9, gain: 0.12, decay: 0.07 }),
    load: () => {
      for (let i = 0; i < 12; i += 1) hiss({ at: i * 0.025 + Math.random() * 0.02, freq: vary(2600, 0.3), q: 2, gain: 0.07, decay: 0.03 });
    },
    crack: ({ quiet }) => {
      const count = quiet ? 3 : 6;
      for (let i = 0; i < count; i += 1) {
        const at = Math.random() * 0.4;
        hiss({ at, freq: vary(3200, 0.25), q: 1.4, type: 'highpass', gain: quiet ? 0.12 : 0.32, decay: 0.035 });
        tone({ at, freq: vary(210, 0.2), type: 'triangle', gain: quiet ? 0.05 : 0.12, decay: 0.04, slide: 0.6 });
      }
    },
    secondCrack: ({ quiet }) => {
      for (let i = 0; i < 8; i += 1) hiss({ at: Math.random() * 0.3, freq: vary(4200, 0.2), q: 1.8, type: 'highpass', gain: quiet ? 0.05 : 0.14, decay: 0.022 });
    },
    eject: () => {
      hiss({ freq: 700, q: 0.7, type: 'lowpass', gain: 0.16, attack: 0.03, decay: 0.35 });
      for (let i = 0; i < 16; i += 1) hiss({ at: 0.05 + i * 0.028 + Math.random() * 0.02, freq: vary(2400, 0.3), q: 2, gain: 0.06, decay: 0.03 });
    },
    bag: () => tone({ freq: vary(170), gain: 0.1, decay: 0.09, slide: 0.55 }),
    sale: ({ matched }) => {
      tone({ freq: 988, type: 'triangle', gain: 0.12, decay: 0.16 });
      tone({ at: 0.07, freq: 1319, type: 'triangle', gain: 0.12, decay: 0.22 });
      if (matched) tone({ at: 0.14, freq: 1568, type: 'triangle', gain: 0.12, decay: 0.3 });
    },
    purchase: () => {
      [523, 659, 784, 1047].forEach((freq, i) => tone({ at: i * 0.06, freq, type: 'triangle', gain: 0.13, decay: 0.25 }));
      hiss({ at: 0.2, freq: 5000, q: 0.8, type: 'highpass', gain: 0.05, decay: 0.2 });
    },
    goal: () => {
      [784, 988, 1175].forEach((freq, i) => tone({ at: i * 0.09, freq, gain: 0.12, decay: 0.45 }));
    },
    bell: () => {
      [0, 0.16].forEach((at) => {
        tone({ at, freq: 1760, gain: 0.1, decay: 0.45 });
        tone({ at, freq: 2640, gain: 0.05, decay: 0.3 });
      });
    },
    catch: () => {
      [880, 1109, 1319, 1760, 2217].forEach((freq, i) => tone({ at: i * 0.05, freq, type: 'triangle', gain: 0.1, decay: 0.3 }));
    },
  };

  // Plays a sound; repeated sounds within minGap seconds are skipped.
  function play(name, options = {}, minGap = 0.05) {
    if (!ctx || muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (lastPlayed.get(name) ?? -1) < minGap) return;
    lastPlayed.set(name, now);
    try {
      SOUNDS[name]?.(options);
    } catch {
      // A failing sound must never stop the game.
    }
  }

  return { unlock, play, setMuted, isMuted: () => muted };
}
