import * as Tone from 'tone';
import { deriveTokens } from './seed.js';

/** Build and play a short recap using Tone.js. */
export async function playRecap(
  seed: string,
  metrics: ReturnType<typeof import('./metrics.js').summarise>,
) {
  // Ensure Tone context is started (user interaction already happened).
  await Tone.start();

  const { synth } = deriveTokens(seed);

  const synthInst = new Tone.Synth({
    oscillator: { type: synth.oscType },
    detune: synth.detune,
  }).toDestination();

  const reverb = new Tone.Reverb({ decay: synth.reverb }).toDestination();
  synthInst.connect(reverb);

  // Derive a simple melodic pattern from metrics.
  const noteCount = Math.max(
    4,
    Math.min(12, Math.round(metrics.clickCount / 2)),
  );
  const now = Tone.now();
  for (let i = 0; i < noteCount; i++) {
    const midi = 60 + ((i * 7) % 12); // simple deterministic pitch sequence
    const dur = '8n';
    synthInst.triggerAttackRelease(
      Tone.Frequency(midi, 'midi').toNote(),
      dur,
      now + i * 0.3,
    );
  }

  // Auto-stop after last note + a second.
  const stopTime = now + noteCount * 0.3 + 1;
  Tone.Transport.scheduleOnce(() => {
    synthInst.dispose();
    reverb.dispose();
  }, stopTime);
}
