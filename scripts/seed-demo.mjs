/**
 * Naplní obchod ukázkovými beaty, aby šel web hned prohlédnout.
 * Zvuk je syntetizovaný (žádná cizí práva), nahrává se stejnou cestou jako z admin formuláře.
 *
 *   node scripts/seed-demo.mjs [--url http://localhost:8787] [--password admin-local-dev] [--count 10]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { computePeaks, peaksToBase64, seedFromPeaks } from '../src/shared/peaks.ts';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const BASE = arg('url', 'http://localhost:8787');
const PASSWORD = arg('password', process.env.ADMIN_PASSWORD ?? 'admin-local-dev');
const COUNT = Number(arg('count', '10'));
const SR = 44100;
const CACHE = '.demo-cache';
mkdirSync(CACHE, { recursive: true });

const BEATS = [
  { title: 'Noční linka', genre: 'Trap', bpm: 140, key: 'F#m', style: 'trap', stems: true },
  { title: 'Betonová růže', genre: 'Drill', bpm: 144, key: 'C#m', style: 'drill', stems: true },
  { title: 'Polaroid', genre: 'Boom Bap', bpm: 90, key: 'Am', style: 'boombap', stems: true },
  { title: 'Velvet Room', genre: 'R&B', bpm: 76, key: 'D#', style: 'rnb', stems: false },
  { title: 'Sodium', genre: 'Rage', bpm: 160, key: 'Gm', style: 'trap', stems: true },
  { title: 'Tramvaj 22', genre: 'Lo-fi', bpm: 82, key: 'C', style: 'boombap', stems: false },
  { title: 'Glasshouse', genre: 'House', bpm: 124, key: 'Fm', style: 'house', stems: true },
  { title: 'Kometa', genre: 'Hyperpop', bpm: 150, key: 'A', style: 'trap', stems: true },
  { title: 'Smoke Signals', genre: 'Trap', bpm: 132, key: 'Dm', style: 'trap', stems: false },
  { title: 'Laguna', genre: 'Afrobeats', bpm: 104, key: 'G', style: 'afro', stems: true },
  { title: 'Static Bloom', genre: 'Drill', bpm: 142, key: 'Em', style: 'drill', stems: true },
  { title: 'Půlnoc v Holešovicích', genre: 'Boom Bap', bpm: 94, key: 'A#m', style: 'boombap', stems: true },
].slice(0, COUNT);

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function synth(beat, idx) {
  const r = rng(1337 + idx * 7919);
  const minor = beat.key.endsWith('m');
  const root = 36 + NOTES.indexOf(beat.key.replace(/m$/, ''));
  const scale = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const beatSec = 60 / beat.bpm;
  const half = beat.style === 'trap' || beat.style === 'drill';
  const barSec = beatSec * 4;
  const bars = Math.max(16, Math.round(46 / barSec / 4) * 4);
  const total = Math.floor(bars * barSec * SR);
  const drums = new Float32Array(total), bass = new Float32Array(total), mel = new Float32Array(total);
  const step = barSec / 16;

  const add = (buf, t0, dur, fn) => {
    const a = Math.floor(t0 * SR), n = Math.floor(dur * SR);
    for (let i = 0; i < n && a + i < total; i++) if (a + i >= 0) buf[a + i] += fn(i / SR, i);
  };
  const kick = (t, g = 1) => add(drums, t, 0.35, (x) => Math.sin(2 * Math.PI * (45 * x + (110 / 28) * (1 - Math.exp(-28 * x)))) * Math.exp(-7 * x) * 0.95 * g);
  const snare = (t, g = 1) => { let lp = 0; add(drums, t, 0.22, (x) => { const n = r() * 2 - 1; lp += 0.5 * (n - lp); return ((n - lp) * 0.6 + Math.sin(2 * Math.PI * 190 * x) * 0.5 * Math.exp(-22 * x)) * Math.exp(-16 * x) * 0.7 * g; }); };
  const hat = (t, g = 1, d = 60) => { let lp = 0; add(drums, t, 0.08, (x) => { const n = r() * 2 - 1; lp += 0.25 * (n - lp); return (n - lp) * Math.exp(-d * x) * 0.3 * g; }); };
  const sub = (t, dur, midi, slideTo) => { let ph = 0; add(bass, t, dur, (x) => { const f = slideTo ? hz(midi) + (hz(slideTo) - hz(midi)) * Math.min(1, x / (dur * 0.6)) : hz(midi); ph += (2 * Math.PI * f) / SR; const env = Math.min(1, x * 200) * Math.exp(-1.6 * x) * Math.min(1, (dur - x) * 60); return Math.tanh(Math.sin(ph) * 2.2) * 0.62 * env; }); };
  const pluck = (t, midi, g = 1, dur = 0.5) => { let ph = 0, lp = 0; add(mel, t, dur, (x) => { ph += hz(midi) / SR; const saw = 2 * (ph % 1) - 1; const tri = 2 * Math.abs(saw) - 1; lp += (0.08 + 0.5 * Math.exp(-9 * x)) * ((saw * 0.5 + tri * 0.5) - lp); return lp * Math.exp(-4.5 * x) * 0.3 * g; }); };
  const pad = (t, dur, midis, g = 1) => { const ph = midis.map(() => [r(), r()]); let lp = 0; add(mel, t, dur, (x) => { let v = 0; midis.forEach((m, k) => { ph[k][0] += hz(m) / SR; ph[k][1] += (hz(m) * 1.006) / SR; v += (2 * (ph[k][0] % 1) - 1) + (2 * (ph[k][1] % 1) - 1); }); lp += 0.035 * (v / midis.length - lp); const env = Math.min(1, x / 0.25) * Math.min(1, (dur - x) / 0.3); return lp * env * 0.2 * g; }); };

  // akordový postup (stupně) a motiv
  const progs = minor ? [[0, 5, 3, 4], [0, 3, 5, 4], [0, 6, 5, 4]] : [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 4]];
  const prog = progs[Math.floor(r() * progs.length)];
  const deg = (d, oct = 0) => root + 12 * oct + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  const motif = Array.from({ length: 8 }, () => (r() < 0.25 ? null : Math.floor(r() * 6)));

  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * barSec;
    const sec = bar / bars;
    const intro = bar < 4, outro = bar >= bars - 2;
    const breakdown = sec > 0.48 && sec < 0.6;
    const chord = prog[bar % 4];
    const full = !intro && !breakdown && !outro;
    const lift = sec > 0.6 ? 1.12 : 1;

    pad(t0, barSec, [deg(chord, 1), deg(chord + 2, 1), deg(chord + 4, 1)], intro || breakdown ? 1.25 : 0.8);
    motif.forEach((m, k) => {
      if (m === null) return;
      if (outro && k > 3) return;
      pluck(t0 + k * step * 2 + (beat.style === 'boombap' && k % 2 ? step * 0.33 : 0), deg(chord + m, 2), (intro ? 0.9 : 0.7) * lift, step * 5);
    });
    if (!full && !(breakdown && bar % 2)) { if (breakdown) sub(t0, barSec * 0.9, deg(chord)); continue; }

    const fill = bar % 4 === 3;
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * step + (beat.style === 'boombap' && s % 2 ? step * 0.3 : 0);
      if (beat.style === 'trap' || beat.style === 'drill') {
        if (s % 2 === 0) hat(t, s % 4 === 0 ? 1 : 0.7);
        if (beat.style === 'drill' && [3, 6, 11].includes(s)) hat(t, 0.6);
        if (fill && s >= 12) { hat(t + step / 3, 0.6); hat(t + (2 * step) / 3, 0.75); }
        if (s === 8) snare(t, 1);
        if (beat.style === 'drill' && s === 15 && fill) snare(t, 0.6);
        const ks = beat.style === 'drill' ? [0, 5, 10] : [0, 6, 10, fill ? 13 : -1];
        if (ks.includes(s)) { kick(t, lift); sub(t, step * (s === 0 ? 5.5 : 3.5), deg(chord), beat.style === 'drill' && s === 10 ? deg(chord) + 5 : undefined); }
      } else if (beat.style === 'house') {
        if (s % 4 === 0) kick(t, lift);
        if (s % 4 === 2) hat(t, 1, 30);
        if (s % 2 === 1) hat(t, 0.4);
        if (s % 8 === 4) snare(t, 0.7);
        if (s % 4 === 2 || s === 15) sub(t, step * 1.6, deg(chord, 1));
      } else if (beat.style === 'afro') {
        if ([0, 6, 10].includes(s)) kick(t, lift);
        if ([4, 12].includes(s)) snare(t, 0.8);
        if ([2, 3, 7, 9, 13, 14].includes(s)) hat(t, 0.8, 40);
        if ([0, 3, 6, 10].includes(s)) sub(t, step * 2.4, deg(chord));
      } else {
        if ([0, 7, 10].includes(s)) kick(t, lift);
        if (s === 4 || s === 12) snare(t, 1);
        if (s % 2 === 0) hat(t, s % 4 === 2 ? 1 : 0.6, 45);
        if ([0, 7, 10].includes(s)) sub(t, step * 3, deg(chord));
      }
    }
  }
  // jednoduchý feedback delay na melodii + mix
  const d = Math.floor(step * 3 * SR);
  for (let i = d; i < total; i++) mel[i] += mel[i - d] * 0.32;
  const mix = new Float32Array(total);
  let peak = 0;
  for (let i = 0; i < total; i++) { mix[i] = Math.tanh((drums[i] + bass[i] + mel[i]) * 1.25); peak = Math.max(peak, Math.abs(mix[i])); }
  const fade = Math.floor(SR * 1.5);
  for (let i = 0; i < total; i++) { mix[i] *= 0.94 / peak; if (i > total - fade) mix[i] *= (total - i) / fade; }
  return { mix, drums, bass, mel, duration: total / SR };
}

function wav(buf, seconds) {
  const n = seconds ? Math.min(buf.length, Math.floor(seconds * SR)) : buf.length;
  const out = Buffer.alloc(44 + n * 4);
  out.write('RIFF', 0); out.writeUInt32LE(36 + n * 4, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28);
  out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, buf[i])) * 32767; out.writeInt16LE(v, 44 + i * 4); out.writeInt16LE(v, 46 + i * 4); }
  return out;
}

let cookie = '';
async function api(path, init = {}) {
  const res = await fetch(BASE + path, { ...init, headers: { 'x-admin': '1', cookie, ...(init.headers ?? {}) } });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function multipart(beatId, kind, data, name) {
  const { key, uploadId } = await api('/api/admin/uploads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ beatId, kind }) });
  const CH = 8 * 1024 * 1024;
  const parts = [];
  for (let i = 0, n = 1; i < data.length; i += CH, n++) {
    parts.push(await api(`/api/admin/uploads/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&part=${n}`, { method: 'PUT', body: data.subarray(i, i + CH) }));
  }
  await api('/api/admin/uploads/complete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ beatId, kind, key, uploadId, parts, name }) });
}

await api('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: PASSWORD }) });
const existing = new Set((await api('/api/admin/beats')).beats.map((b) => b.title));

for (const [idx, beat] of BEATS.entries()) {
  if (existing.has(beat.title)) { console.log(`= ${beat.title} (už existuje)`); continue; }
  const s = synth(beat, idx);
  const base = join(CACHE, `demo-${idx}`);
  writeFileSync(`${base}.wav`, wav(s.mix));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${base}.wav`, '-codec:a', 'libmp3lame', '-b:a', '128k', `${base}.mp3`]);
  const peaks = computePeaks([s.mix]);
  const { beat: created } = await api('/api/admin/beats', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: beat.title, bpm: beat.bpm, key: beat.key, genre: beat.genre, duration: s.duration, peaks: peaksToBase64(peaks), seed: seedFromPeaks(peaks), sortOrder: 100 + idx }),
  });
  await api(`/api/admin/files?beatId=${created.id}&kind=preview`, { method: 'PUT', body: readFileSync(`${base}.mp3`) });
  await multipart(created.id, 'wav', readFileSync(`${base}.wav`), `${beat.title}.wav`);
  if (beat.stems) {
    for (const [n, b] of [['drums', s.drums], ['bass', s.bass], ['melody', s.mel]]) writeFileSync(join(CACHE, `${n}.wav`), wav(b, 20));
    if (existsSync(`${base}.zip`)) execFileSync('rm', [`${base}.zip`]);
    execFileSync('zip', ['-j', '-q', `${base}.zip`, join(CACHE, 'drums.wav'), join(CACHE, 'bass.wav'), join(CACHE, 'melody.wav')]);
    await multipart(created.id, 'stems', readFileSync(`${base}.zip`), `${beat.title} (stems).zip`);
  }
  await api(`/api/admin/beats/${created.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'active' }) });
  console.log(`+ ${beat.title} — ${beat.bpm} BPM ${beat.key} (${s.duration.toFixed(0)} s)`);
}
console.log('Hotovo.');
