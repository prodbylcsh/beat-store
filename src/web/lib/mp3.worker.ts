/// <reference lib="webworker" />
import { Mp3Encoder } from '@breezystack/lamejs';

self.onmessage = (e: MessageEvent<{ left: Float32Array; right: Float32Array; sampleRate: number; kbps: number }>) => {
  try {
    const { left, right, sampleRate, kbps } = e.data;
    const enc = new Mp3Encoder(2, sampleRate, kbps);
    const BLOCK = 1152 * 40;
    const chunks: Uint8Array[] = [];
    const toInt = (f: Float32Array, a: number, b: number) => {
      const out = new Int16Array(b - a);
      for (let i = a; i < b; i++) { const v = Math.max(-1, Math.min(1, f[i])); out[i - a] = v < 0 ? v * 32768 : v * 32767; }
      return out;
    };
    for (let i = 0; i < left.length; i += BLOCK) {
      const end = Math.min(left.length, i + BLOCK);
      const buf = enc.encodeBuffer(toInt(left, i, end), toInt(right, i, end));
      if (buf.length) chunks.push(new Uint8Array(buf));
      if ((i / BLOCK) % 8 === 0) self.postMessage({ progress: i / left.length });
    }
    const tail = enc.flush();
    if (tail.length) chunks.push(new Uint8Array(tail));
    self.postMessage({ blob: new Blob(chunks as BlobPart[], { type: 'audio/mpeg' }) });
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};
