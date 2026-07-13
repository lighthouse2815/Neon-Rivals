import { Howl, Howler } from "howler";

const sampleRate = 22_050;

type ToneOptions = {
  frequency: number;
  durationMs: number;
  volume: number;
  curve?: "sine" | "square" | "triangle";
  sweep?: number;
};

const createToneDataUri = ({
  frequency,
  durationMs,
  volume,
  curve = "sine",
  sweep = 0
}: ToneOptions): string => {
  const totalSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string): void => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeAscii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, totalSamples * 2, true);

  for (let index = 0; index < totalSamples; index += 1) {
    const progress = index / totalSamples;
    const currentFrequency = frequency + sweep * progress;
    const angle = (index / sampleRate) * currentFrequency * Math.PI * 2;
    const envelope = Math.max(0, 1 - progress);
    const rawValue =
      curve === "square"
        ? Math.sign(Math.sin(angle))
        : curve === "triangle"
          ? (2 / Math.PI) * Math.asin(Math.sin(angle))
          : Math.sin(angle);
    const sample = rawValue * volume * envelope;
    view.setInt16(44 + index * 2, sample * 0x7fff, true);
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
};

export class AudioManager {
  private readonly sounds = {
    shoot: new Howl({
      src: [createToneDataUri({ frequency: 480, durationMs: 80, volume: 0.28, sweep: -120 })]
    }),
    dash: new Howl({
      src: [createToneDataUri({ frequency: 220, durationMs: 140, volume: 0.22, curve: "triangle", sweep: 220 })]
    }),
    hit: new Howl({
      src: [createToneDataUri({ frequency: 180, durationMs: 120, volume: 0.24, curve: "square", sweep: -80 })]
    }),
    round: new Howl({
      src: [createToneDataUri({ frequency: 680, durationMs: 240, volume: 0.24, curve: "triangle", sweep: 160 })]
    }),
    win: new Howl({
      src: [createToneDataUri({ frequency: 880, durationMs: 400, volume: 0.2, curve: "sine", sweep: 220 })]
    })
  };

  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    Howler.mute(!enabled);
  }

  playShoot(): void {
    if (this.enabled) this.sounds.shoot.play();
  }

  playDash(): void {
    if (this.enabled) this.sounds.dash.play();
  }

  playHit(): void {
    if (this.enabled) this.sounds.hit.play();
  }

  playRound(): void {
    if (this.enabled) this.sounds.round.play();
  }

  playWin(): void {
    if (this.enabled) this.sounds.win.play();
  }
}
