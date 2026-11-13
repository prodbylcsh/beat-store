import { beatPalette, type Rgb } from '../../shared/music';
import { peaksFromBase64 } from '../../shared/peaks';
import type { Beat } from '../../shared/types';
import { discArt } from './disc-art';

/**
 * Generativní artwork: každý beat je 3D deska, jejíž drážka je skutečný waveform skladby.
 * Barva vinylu = tónina, mramorování = otisk zvuku, do vinylu je vyrytý název, BPM, tónina a žánr.
 * Deska je analyticky trasovaný válec ve fragment shaderu – žádná geometrie, libovolné natočení.
 */

const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uOrigin;     // levý dolní roh oblasti v px
uniform float uSize;      // strana čtvercové oblasti v px
uniform float uPad;       // rezerva kolem desky
uniform mat3 uRot;        // natočení desky (lokální -> pohled)
uniform float uCam;       // vzdálenost kamery v poloměrech desky
uniform float uSpin;
uniform float uProgress;  // 0..1, -1 = nehraje
uniform float uLevel;     // basy 0..1
uniform float uTurns;
uniform float uAlpha;
uniform float uLive;
uniform float uFlat;      // 1 = plochý náhled
uniform float uShadow;    // 0 nic, 1 leží na stole, 2 stojí
uniform float uT12;       // čas kvantovaný na 12 fps (kreslené efekty)
uniform float uMix;       // prolnutí beatu A -> B
uniform sampler2D uPeaksA;
uniform sampler2D uPeaksB;
uniform sampler2D uArtA;
uniform sampler2D uArtB;
uniform vec3 uMainA; uniform vec3 uAltA; uniform vec3 uDeepA; uniform float uSeedA;
uniform vec3 uMainB; uniform vec3 uAltB; uniform vec3 uDeepB; uniform float uSeedB;

const float PI = 3.14159265;
const float R0 = 0.335;
const float R1 = 0.955;
const float RL = 0.292;
const float HALF = 0.02;  // poloviční tloušťka desky

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec3 marble(vec2 q, vec3 mainC, vec3 altC, vec3 deepC, float seed){
  vec2 o = vec2(mod(seed, 97.0), mod(seed * 0.37, 89.0));
  float style = mod(seed, 4.0);
  vec2 w = q + 0.55 * vec2(fbm(q * 1.6 + o), fbm(q * 1.6 + o + 31.7));
  float n = fbm(w * (1.4 + style * 0.5) + o);
  vec3 c = mix(mainC, altC, smoothstep(0.42, 0.66, n) * (style < 1.0 ? 0.35 : 0.85));
  float veins = smoothstep(0.022, 0.0, abs(fbm(w * 2.6 + o * 1.7) - 0.5));
  c = mix(c, mix(deepC, altC, 0.35), veins * 0.3);
  if (style >= 3.0) {
    float sp = smoothstep(0.78, 0.8, vnoise(q * 13.0 + o));
    c = mix(c, altC * 0.55 + deepC * 0.3, sp * 0.8);
  }
  return c;
}

// průsečík paprsku s deskou (válec); vrací 0 nic, 1 líc, 2 rub, 3 bok
int trace(vec2 q, out vec3 p){
  mat3 Rt = transpose(uRot);
  vec3 lo = Rt * vec3(0.0, 0.0, uCam);
  vec3 ld = Rt * vec3(q, -uCam);
  float best = 1e9; int kind = 0;
  float hh = HALF * (1.0 - uFlat * 0.9);
  if (abs(ld.z) > 1e-5) {
    for (int i = 0; i < 2; i++) {
      float s = i == 0 ? 1.0 : -1.0;
      float t = (s * hh - lo.z) / ld.z;
      vec3 c = lo + t * ld;
      if (t > 0.0 && t < best && dot(c.xy, c.xy) <= 1.0) { best = t; kind = i + 1; p = c; }
    }
  }
  float a = dot(ld.xy, ld.xy), b = dot(lo.xy, ld.xy), c = dot(lo.xy, lo.xy) - 1.0;
  float d = b * b - a * c;
  if (a > 1e-6 && d > 0.0) {
    float t = (-b - sqrt(d)) / a;
    vec3 s = lo + t * ld;
    if (t > 0.0 && t < best && abs(s.z) <= hh) { best = t; kind = 3; p = s; }
  }
  return kind;
}

// bod na rovině desky (i mimo ni) – pro záři, stín a kreslené vlny
vec2 planePoint(vec2 q){
  mat3 Rt = transpose(uRot);
  vec3 lo = Rt * vec3(0.0, 0.0, uCam);
  vec3 ld = Rt * vec3(q, -uCam);
  float t = -lo.z / (abs(ld.z) > 1e-5 ? ld.z : 1e-5);
  return (lo + t * ld).xy;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - uOrigin) / uSize * 2.0 - 1.0;
  vec2 q = uv * uPad;
  float px = 2.0 * uPad / uSize;
  float fade = smoothstep(uPad, uPad - 0.16, max(abs(q.x), abs(q.y)));

  vec3 mainC = mix(uMainA, uMainB, uMix);
  vec3 altC = mix(uAltA, uAltB, uMix);
  vec3 deepC = mix(uDeepA, uDeepB, uMix);

  vec4 acc = vec4(0.0);
  vec2 pl = planePoint(q);
  float rp = length(pl);

  if (uFlat < 0.5) {
    float sh = 0.0;
    if (uShadow > 1.5) {
      vec2 e = (q - vec2(0.0, -1.07)) / vec2(0.2 + 0.72 * abs(uRot[0][0]), 0.075);
      sh = smoothstep(1.0, 0.15, length(e)) * 0.34;
    } else if (uShadow > 0.5) {
      sh = smoothstep(1.14, 0.84, length(planePoint(q + vec2(0.0, 0.085)))) * 0.26;
    }
    acc = vec4(0.0, 0.0, 0.0, sh * (1.0 - uLive) * fade);
    float glow = exp(-max(rp - 1.0, 0.0) * 8.0) * uLive * (0.16 + 0.34 * uLevel) * fade;
    acc.rgb += mainC * glow; acc.a = max(acc.a, glow * 0.8);

    // kreslené zvukové vlny kolem hrající desky – běží na 12 fps
    if (uProgress >= 0.0 && uLevel > 0.02) {
      float th = atan(pl.y, pl.x);
      float wob = (vnoise(vec2(th * 2.5, uT12 * 1.7)) - 0.5) * 0.07;
      float phase = fract(uT12 / 9.0);
      float ring = 0.0;
      for (int k = 0; k < 2; k++) {
        float rr = 1.06 + 0.2 * fract(phase + float(k) * 0.5) + wob;
        float gapMask = step(0.32, vnoise(vec2(th * 4.0 + float(k) * 9.0, uT12)));
        ring += smoothstep(0.016, 0.004, abs(rp - rr)) * gapMask * (1.0 - fract(phase + float(k) * 0.5));
      }
      ring *= clamp(uLevel * 2.6, 0.0, 1.0) * fade;
      vec3 ringC = mix(vec3(0.06), mix(mainC, vec3(1.0), 0.45), uLive);
      acc = mix(acc, vec4(ringC, 1.0), clamp(ring, 0.0, 1.0) * 0.85);
    }
  }

  // pokrytí ze 4 vzorků = vyhlazená silueta
  vec3 hp = vec3(0.0); int kind = 0; float cov = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(i < 2 ? -0.27 : 0.27, (i == 0 || i == 2) ? -0.27 : 0.27) * px;
    vec3 tp; int k = trace(q + o, tp);
    if (k > 0) { cov += 0.25; hp = tp; kind = k; }
  }
  vec3 cp; int ck = trace(q, cp);
  if (ck > 0) { hp = cp; kind = ck; }

  if (cov > 0.0) {
    vec3 L = normalize(vec3(-0.42, 0.62, 0.66));
    vec3 Hv = normalize(L + vec3(0.0, 0.0, 1.0));
    vec3 H2 = normalize(vec3(0.55, 0.35, 0.76) + vec3(0.0, 0.0, 1.0));
    vec3 col;
    float holeA = 1.0;

    if (kind == 3) {
      vec3 n = uRot * normalize(vec3(hp.xy, 0.0));
      float lit = 0.3 + 0.7 * max(dot(n, L), 0.0);
      col = (deepC * 0.75 + mainC * 0.35) * lit + vec3(1.0) * pow(max(dot(n, Hv), 0.0), 24.0) * 0.5;
      col *= 0.85 + 0.15 * smoothstep(-HALF, HALF, hp.z);
    } else {
      bool front = kind == 1;
      vec2 P = front ? hp.xy : vec2(-hp.x, hp.y);
      float r = length(P);
      float aaR = fwidth(r) * 1.25 + 1e-4;
      float theta = atan(P.y, P.x);
      vec2 Ps = rot(-uSpin * (front ? 1.0 : -1.0)) * P;
      float thetaS = atan(Ps.y, Ps.x);

      vec3 bodyA = marble(Ps, uMainA, uAltA, uDeepA, uSeedA);
      vec3 body = uMix > 0.001 ? mix(bodyA, marble(Ps, uMainB, uAltB, uDeepB, uSeedB), uMix) : bodyA;
      col = body;

      vec2 auv = vec2(Ps.x, -Ps.y) * 0.5 + 0.5;
      vec4 art = mix(texture(uArtA, auv), texture(uArtB, auv), uMix);

      // --- drážka: spirála, šířka = hlasitost v daném místě skladby ---
      float zone = smoothstep(R0 - aaR, R0 + aaR, r) * (1.0 - smoothstep(R1 - aaR, R1 + aaR, r));
      float u = (R1 - r) / (R1 - R0) * uTurns;
      float tn = fract(thetaS / (2.0 * PI) + 0.25);
      float s = u - tn;
      float t = (floor(s) + tn) / uTurns;
      float inTrack = step(0.0, t) * step(t, 1.0);
      float amp = mix(texture(uPeaksA, vec2(t, 0.5)).r, texture(uPeaksB, vec2(t, 0.5)).r, uMix) * inTrack;
      float f = abs(fract(s) - 0.5);
      float aaS = fwidth(u) * 1.2 + 1e-4;
      float detail = clamp(0.55 / aaS, 0.0, 1.0);
      float w = 0.045 + 0.4 * pow(amp, 1.35) * (1.0 + 0.3 * uLevel);
      float line = (1.0 - smoothstep(w - aaS, w + aaS, f));
      line = mix(w * 2.0, line, detail);

      // rytina: v místě písma je vinyl hladký, matný a o něco světlejší
      float etch = front ? art.a * step(RL + 0.02, r) : 0.0;
      line *= 1.0 - etch * 0.92;

      float played = (front && uProgress >= 0.0) ? step(t, uProgress) * inTrack : 0.0;
      vec3 wall = body * 0.36 + deepC * 0.1;
      vec3 lit = mix(vec3(1.0, 0.975, 0.92), mainC, 0.12);
      col = mix(col, mix(wall, lit, played), line * zone * 0.9);
      col = mix(col, body * 1.2 + 0.07 + 0.05 * hash(Ps * 420.0), etch * 0.86);
      if (front && uProgress >= 0.0) {
        float head = exp(-abs(t - uProgress) * uTurns * 5.0) * inTrack * zone;
        col += vec3(1.0, 0.95, 0.85) * head * (0.5 + 0.6 * uLevel);
      }

      // --- anizotropní lesk vinylu, závislý na skutečném natočení ---
      vec3 T = uRot * vec3(-sin(theta) * (front ? 1.0 : -1.0), cos(theta), 0.0);
      vec3 N = uRot * vec3(0.0, 0.0, front ? 1.0 : -1.0);
      float d1 = dot(T, Hv), d2 = dot(T, H2);
      float spec = pow(max(0.0, 1.0 - d1 * d1), 60.0) * smoothstep(0.0, 0.4, dot(N, Hv))
                 + 0.5 * pow(max(0.0, 1.0 - d2 * d2), 90.0) * smoothstep(0.0, 0.4, dot(N, H2));
      float micro = 0.72 + 0.28 * mix(0.5, sin(fract(s) * 2.0 * PI) * 0.5 + 0.5, detail);
      float sheenMask = smoothstep(RL, R0, r) * (1.0 - etch * 0.75);
      col += vec3(1.0, 0.98, 0.95) * spec * micro * sheenMask * (0.42 + 0.2 * uLive);
      col *= 0.8 + 0.26 * max(dot(N, L), 0.0);
      col += mainC * pow(1.0 - abs(N.z), 3.0) * 0.35;

      float edge = smoothstep(0.972, 0.995, r);
      col = mix(col, col * 1.18 + 0.05, edge * 0.7);
      float runout = (1.0 - zone) * step(RL, r);
      col = mix(col, col * 0.9, runout * 0.5);

      // --- etiketa ---
      float lab = 1.0 - smoothstep(RL - aaR, RL + aaR, r);
      if (lab > 0.0) {
        vec3 lc = front ? art.rgb : mix(vec3(0.93, 0.915, 0.88), mainC, 0.5) * (0.9 + 0.1 * step(0.5, fract(r / RL * 4.0)));
        lc *= (0.86 + 0.2 * max(dot(N, L), 0.0)) * (0.97 + 0.06 * hash(Ps * 300.0));
        col = mix(col, lc, lab);
      }
      holeA = smoothstep(0.03 - aaR, 0.03 + aaR, r);
      col = mix(col, vec3(0.05), (1.0 - smoothstep(0.04, 0.05, r)) * 0.6);
    }
    acc = mix(acc, vec4(col, 1.0), cov);
    acc *= mix(1.0, holeA, cov);
  }

  outColor = acc * uAlpha; // premultiplied
}`;

export interface DiscLook {
  id: string;
  peaks: Uint8Array;
  main: Rgb; alt: Rgb; deep: Rgb;
  seed: number;
  art: () => HTMLCanvasElement;
}

export interface DrawParams {
  /** střed a průměr desky v CSS px relativně k plátnu */
  cx: number; cy: number; size: number;
  /** náklon dozadu (leží na stole), otočení kolem svislé osy, naklonění v rovině obrazu */
  pitch: number; yaw?: number; roll?: number;
  spin: number; progress: number; level: number;
  alpha: number; live: number; flat?: boolean; mix?: number;
  shadow?: 0 | 1 | 2;
  /** čas v sekundách (pro efekty na 12 fps) */
  time?: number;
}

const lookCache = new Map<string, DiscLook>();
export function lookFor(beat: Pick<Beat, 'id' | 'peaks' | 'key' | 'seed' | 'title' | 'bpm' | 'genre'>): DiscLook {
  const ck = `${beat.id}|${beat.key}|${beat.title}|${beat.bpm}|${beat.genre}`;
  let l = lookCache.get(ck);
  if (!l) {
    const p = beatPalette(beat.key, beat.seed);
    // jen pro obraz: roztáhni dynamiku, aby tiché a hlasité pasáže byly v drážce dobře čitelné
    const raw = peaksFromBase64(beat.peaks);
    const sorted = Array.from(raw).sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.04)] ?? 0, hi = sorted[sorted.length - 1] || 1;
    const peaks = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) peaks[i] = Math.round(255 * Math.min(1, Math.max(0, (raw[i] - lo * 0.85) / Math.max(1, hi - lo * 0.85))));
    l = { id: ck, peaks, main: p.main, alt: p.alt, deep: p.deep, seed: beat.seed % 100000, art: () => discArt(beat) };
    lookCache.set(ck, l);
  }
  return l;
}

interface GpuLook { peaks: WebGLTexture; art: WebGLTexture; artSrc: HTMLCanvasElement; used: number }

export class GrooveRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private gpu = new Map<string, GpuLook>();
  private bound: [string, string] = ['', ''];
  private tick = 0;
  dpr = 1;

  constructor(canvas: HTMLCanvasElement, preserve = false) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: preserve });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uOrigin', 'uSize', 'uPad', 'uRot', 'uCam', 'uSpin', 'uProgress', 'uLevel', 'uTurns', 'uAlpha', 'uLive', 'uFlat', 'uShadow', 'uT12', 'uMix',
      'uPeaksA', 'uPeaksB', 'uArtA', 'uArtB', 'uMainA', 'uAltA', 'uDeepA', 'uSeedA', 'uMainB', 'uAltB', 'uDeepB', 'uSeedB']) {
      this.u[n] = gl.getUniformLocation(prog, n);
    }
    gl.uniform1i(this.u.uPeaksA, 0);
    gl.uniform1i(this.u.uPeaksB, 1);
    gl.uniform1i(this.u.uArtA, 2);
    gl.uniform1i(this.u.uArtB, 3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.SCISSOR_TEST);
  }

  private tex(linearMips: boolean): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linearMips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private gpuLook(look: DiscLook): GpuLook {
    const gl = this.gl;
    let g = this.gpu.get(look.id);
    const src = look.art();
    if (!g) {
      gl.activeTexture(gl.TEXTURE7);
      const peaks = this.tex(false);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, look.peaks.length, 1, 0, gl.RED, gl.UNSIGNED_BYTE, look.peaks);
      g = { peaks, art: this.tex(true), artSrc: null as unknown as HTMLCanvasElement, used: 0 };
      this.gpu.set(look.id, g);
      // drž v paměti nejvýše ~28 desek
      if (this.gpu.size > 28) {
        const old = [...this.gpu.entries()].sort((a, b) => a[1].used - b[1].used)[0];
        gl.deleteTexture(old[1].peaks); gl.deleteTexture(old[1].art);
        this.gpu.delete(old[0]);
        this.bound = ['', ''];
      }
    }
    if (g.artSrc !== src) { // nová nebo po načtení písem překreslená etiketa
      gl.activeTexture(gl.TEXTURE7);
      gl.bindTexture(gl.TEXTURE_2D, g.art);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.generateMipmap(gl.TEXTURE_2D);
      g.artSrc = src;
      this.bound = ['', ''];
    }
    g.used = ++this.tick;
    return g;
  }

  /** slot 0 = A (odkud), 1 = B (kam se prolíná) */
  setLook(slot: 0 | 1, look: DiscLook): void {
    const g = this.gpuLook(look);
    if (this.bound[slot] === look.id) return;
    this.bound[slot] = look.id;
    const gl = this.gl;
    gl.activeTexture(slot === 0 ? gl.TEXTURE0 : gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, g.peaks);
    gl.activeTexture(slot === 0 ? gl.TEXTURE2 : gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, g.art);
    const s = slot === 0 ? 'A' : 'B';
    gl.uniform3f(this.u[`uMain${s}`], look.main.r, look.main.g, look.main.b);
    gl.uniform3f(this.u[`uAlt${s}`], look.alt.r, look.alt.g, look.alt.b);
    gl.uniform3f(this.u[`uDeep${s}`], look.deep.r, look.deep.g, look.deep.b);
    gl.uniform1f(this.u[`uSeed${s}`], look.seed);
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.dpr = dpr;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  clear(): void {
    const gl = this.gl;
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
  }

  /** Vykreslí desku s looky nastavenými přes setLook (slot 0, případně prolnutí do slotu 1). */
  draw(p: DrawParams): void {
    if (!this.bound[0]) return;
    const gl = this.gl;
    const flat = !!p.flat;
    const pad = flat ? 1.02 : 1.34;
    const side = p.size * pad * this.dpr;
    const x = p.cx * this.dpr - side / 2;
    const y = this.canvas.height - p.cy * this.dpr - side / 2;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.scissor(Math.floor(x), Math.floor(y), Math.ceil(side) + 1, Math.ceil(side) + 1);
    gl.uniform2f(this.u.uOrigin, x, y);
    gl.uniform1f(this.u.uSize, side);
    gl.uniform1f(this.u.uPad, pad);
    // R = Ry(yaw) * Rx(-pitch) * Rz(roll); sloupcově pro GLSL
    const cy = Math.cos(p.yaw ?? 0), sy = Math.sin(p.yaw ?? 0);
    const cp = Math.cos(-p.pitch), sp = Math.sin(-p.pitch);
    const cr = Math.cos(p.roll ?? 0), sr = Math.sin(p.roll ?? 0);
    const m = [
      cy * cr + sy * sp * sr, cp * sr, -sy * cr + cy * sp * sr,
      -cy * sr + sy * sp * cr, cp * cr, sy * sr + cy * sp * cr,
      sy * cp, -sp, cy * cp,
    ];
    gl.uniformMatrix3fv(this.u.uRot, false, m);
    gl.uniform1f(this.u.uCam, flat ? 60 : 4.6);
    gl.uniform1f(this.u.uSpin, p.spin);
    gl.uniform1f(this.u.uProgress, p.progress);
    gl.uniform1f(this.u.uLevel, p.level);
    const bandPx = (p.size / 2) * 0.62;
    gl.uniform1f(this.u.uTurns, Math.round(Math.min(46, Math.max(7, bandPx / (p.size > 300 ? 6.2 : 4.4)))));
    gl.uniform1f(this.u.uAlpha, p.alpha);
    gl.uniform1f(this.u.uLive, p.live);
    gl.uniform1f(this.u.uFlat, flat ? 1 : 0);
    gl.uniform1f(this.u.uShadow, p.shadow ?? 1);
    gl.uniform1f(this.u.uT12, Math.floor((p.time ?? 0) * 12));
    gl.uniform1f(this.u.uMix, p.mix ?? 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Zkratka: jedna deska bez prolínání. */
  drawBeat(look: DiscLook, p: DrawParams): void {
    this.setLook(0, look);
    this.setLook(1, look);
    this.draw({ ...p, mix: 0 });
  }
}

/* ----------------------- statické obaly (řádky, admin) ----------------------- */

let coverRenderer: GrooveRenderer | null | undefined;
const COVER_PX = 220;

export function paintCover(target: HTMLCanvasElement, beat: Beat): boolean {
  if (coverRenderer === undefined) {
    try {
      coverRenderer = new GrooveRenderer(document.createElement('canvas'), true);
      coverRenderer.resize(COVER_PX, COVER_PX, 1);
    } catch {
      coverRenderer = null;
    }
  }
  if (!coverRenderer) return false;
  coverRenderer.clear();
  coverRenderer.drawBeat(lookFor(beat), {
    cx: COVER_PX / 2, cy: COVER_PX / 2, size: COVER_PX / 1.02, pitch: 0, spin: 0,
    progress: -1, level: 0, alpha: 1, live: 0, flat: true, shadow: 0,
  });
  target.width = COVER_PX;
  target.height = COVER_PX;
  const ctx = target.getContext('2d');
  if (!ctx) return false;
  ctx.clearRect(0, 0, COVER_PX, COVER_PX);
  ctx.drawImage(coverRenderer.canvas, 0, 0);
  return true;
}
