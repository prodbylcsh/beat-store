import { beatPalette, type Rgb } from '../../shared/music';
import { peaksFromBase64 } from '../../shared/peaks';
import type { Beat } from '../../shared/types';

/**
 * Generativní artwork: každý beat je deska, jejíž drážka je skutečný waveform skladby.
 * Barva vinylu = tónina (kvintový kruh → barevné kolo), mramorování a etiketa = otisk zvuku.
 * Celé se kreslí jedním fragment shaderem (žádná geometrie, žádné textury kromě obálky).
 */

const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uOrigin;     // levý dolní roh oblasti v px
uniform float uSize;      // strana čtvercové oblasti v px
uniform float uPad;       // rezerva kolem desky (stín, tloušťka)
uniform float uTilt;
uniform float uSpin;
uniform float uProgress;  // 0..1, -1 = nehraje
uniform float uLevel;     // basy 0..1
uniform float uTurns;
uniform float uAlpha;
uniform float uLive;
uniform float uFlat;      // 1 = náhled (bez stínu a tloušťky)
uniform float uMix;       // prolnutí beatu A -> B
uniform sampler2D uPeaksA;
uniform sampler2D uPeaksB;
uniform vec3 uMainA; uniform vec3 uAltA; uniform vec3 uDeepA; uniform float uSeedA;
uniform vec3 uMainB; uniform vec3 uAltB; uniform vec3 uDeepB; uniform float uSeedB;

const float PI = 3.14159265;
const float R0 = 0.335;   // konec drážky u etikety
const float R1 = 0.955;   // začátek drážky u okraje
const float RL = 0.292;   // etiketa

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
  if (style >= 3.0) { // splatter
    float sp = smoothstep(0.78, 0.8, vnoise(q * 13.0 + o));
    c = mix(c, altC * 0.55 + deepC * 0.3, sp * 0.8);
  }
  return c;
}

vec3 labelArt(vec2 q, float r, vec3 mainC, vec3 altC, vec3 deepC, float seed){
  vec3 paper = vec3(0.945, 0.93, 0.895);
  vec3 ink = vec3(0.06, 0.06, 0.055);
  float kind = mod(floor(seed / 7.0), 4.0);
  float rr = r / RL;
  float aa = fwidth(rr) * 1.5;
  vec3 c = paper;
  if (kind < 1.0) {            // půlená etiketa
    c = mix(paper, ink, smoothstep(-aa, aa, q.y / RL));
    c = mix(c, altC, smoothstep(aa, -aa, abs(q.y / RL) - 0.06));
  } else if (kind < 2.0) {     // terč
    float rings = abs(fract(rr * 3.5) - 0.5);
    c = mix(ink, paper, smoothstep(0.25 - aa * 2.0, 0.25 + aa * 2.0, rings));
  } else if (kind < 3.0) {     // výseče
    float a = atan(q.y, q.x) / (2.0 * PI) + 0.5;
    float seg = step(0.5, fract(a * 6.0));
    c = mix(paper, ink, seg * step(0.45, rr));
    c = mix(c, altC, smoothstep(0.45 + aa, 0.45 - aa, rr));
  } else {                     // inkoustová s pruhem
    c = ink;
    c = mix(c, paper, smoothstep(aa, -aa, abs(rr - 0.72) - 0.07));
  }
  // tenký barevný prstenec u kraje etikety
  c = mix(c, mainC * 0.55, smoothstep(aa, -aa, abs(rr - 0.955) - 0.03));
  return c;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - uOrigin) / uSize * 2.0 - 1.0;
  vec2 q = uv * uPad;
  float ct = cos(uTilt), st = sin(uTilt);
  float th = 0.05 * st * (1.0 - uFlat);
  vec2 P = vec2(q.x, (q.y - th * 0.5) / ct);
  float r = length(P);
  float aaR = fwidth(r) * 1.25;

  vec3 mainC = mix(uMainA, uMainB, uMix);
  vec3 altC = mix(uAltA, uAltB, uMix);
  vec3 deepC = mix(uDeepA, uDeepB, uMix);

  vec4 acc = vec4(0.0);

  if (uFlat < 0.5) {
    // stín na stole (ve dne) / záře (ve tmě)
    vec2 S = vec2(q.x, (q.y + th * 0.5 + 0.075) / ct);
    float sh = smoothstep(1.16, 0.86, length(S)) * 0.26 * (1.0 - uLive) * smoothstep(uPad, uPad - 0.1, max(abs(q.x), abs(q.y)));
    acc = vec4(0.0, 0.0, 0.0, sh);
    float glow = exp(-max(r - 1.0, 0.0) * 8.0) * uLive * (0.16 + 0.34 * uLevel) * smoothstep(uPad, uPad - 0.2, max(abs(q.x), abs(q.y)));
    acc.rgb += mainC * glow; acc.a = max(acc.a, glow * 0.8);
    // bok desky
    vec2 B = vec2(q.x, (q.y + th * 0.5) / ct);
    float side = 1.0 - smoothstep(1.0 - aaR, 1.0 + aaR, length(B));
    vec3 sideC = deepC * (0.35 + 0.3 * smoothstep(-1.0, 1.0, q.x)) + mainC * 0.12;
    acc = mix(acc, vec4(sideC, 1.0), side);
  }

  float inside = 1.0 - smoothstep(1.0 - aaR, 1.0 + aaR, r);
  if (inside > 0.0) {
    float theta = atan(P.y, P.x);
    vec2 Ps = rot(-uSpin) * P;            // souřadnice otáčející se s deskou
    float thetaS = atan(Ps.y, Ps.x);

    vec3 bodyA = marble(Ps, uMainA, uAltA, uDeepA, uSeedA);
    vec3 body = uMix > 0.001 ? mix(bodyA, marble(Ps, uMainB, uAltB, uDeepB, uSeedB), uMix) : bodyA;
    vec3 col = body;

    // --- drážka: spirála, šířka = hlasitost v daném místě skladby ---
    float zone = smoothstep(R0 - aaR, R0 + aaR, r) * (1.0 - smoothstep(R1 - aaR, R1 + aaR, r));
    float u = (R1 - r) / (R1 - R0) * uTurns;
    float tn = fract(thetaS / (2.0 * PI) + 0.25);
    float s = u - tn;
    float t = (floor(s) + tn) / uTurns;
    float inTrack = step(0.0, t) * step(t, 1.0);
    float amp = mix(texture(uPeaksA, vec2(t, 0.5)).r, texture(uPeaksB, vec2(t, 0.5)).r, uMix) * inTrack;
    float f = abs(fract(s) - 0.5);
    float aaS = fwidth(u) * 1.2;
    float detail = clamp(0.55 / aaS, 0.0, 1.0);     // když je drážka menší než pixel, zprůměruj
    float w = 0.045 + 0.4 * pow(amp, 1.35) * (1.0 + 0.3 * uLevel);
    float line = (1.0 - smoothstep(w - aaS, w + aaS, f));
    line = mix(w * 2.0, line, detail);

    float played = uProgress >= 0.0 ? step(t, uProgress) * inTrack : 0.0;
    vec3 wall = body * 0.36 + deepC * 0.1;
    vec3 lit = mix(vec3(1.0, 0.975, 0.92), mainC, 0.12);
    vec3 lineC = mix(wall, lit, played);
    col = mix(col, lineC, line * zone * 0.9);
    // „jehla“: světlá hrana na aktuální pozici
    if (uProgress >= 0.0) {
      float head = exp(-abs(t - uProgress) * uTurns * 5.0) * inTrack * zone;
      col += vec3(1.0, 0.95, 0.85) * head * (0.5 + 0.6 * uLevel);
    }

    // --- anizotropní lesk vinylu (motýlek), nehybný vůči světlu ---
    vec2 T = vec2(-sin(theta), cos(theta));
    float d1 = dot(T, vec2(0.62, 0.55));
    float d2 = dot(T, vec2(-0.5, 0.68));
    float spec = pow(max(0.0, 1.0 - d1 * d1), 46.0) + 0.45 * pow(max(0.0, 1.0 - d2 * d2), 70.0);
    float micro = 0.72 + 0.28 * mix(0.5, sin(fract(s) * 2.0 * PI) * 0.5 + 0.5, detail);
    float sheenMask = smoothstep(RL, R0, r);
    col += vec3(1.0, 0.98, 0.95) * spec * micro * sheenMask * (0.34 + 0.2 * uLive);
    col *= 0.94 + 0.1 * P.y;

    // mrtvá plocha a okrajová hrana
    float edge = smoothstep(0.972, 0.995, r);
    col = mix(col, col * 1.18 + 0.05, edge * 0.7);
    float runout = (1.0 - zone) * step(RL, r);
    col = mix(col, col * 0.9, runout * 0.5);

    // --- etiketa ---
    float lab = 1.0 - smoothstep(RL - aaR, RL + aaR, r);
    if (lab > 0.0) {
      vec3 la = labelArt(Ps, r, uMainA, uAltA, uDeepA, uSeedA);
      vec3 lb = uMix > 0.001 ? labelArt(Ps, r, uMainB, uAltB, uDeepB, uSeedB) : la;
      vec3 lc = mix(la, lb, uMix);
      lc *= 0.96 + 0.08 * P.y;
      col = mix(col, lc, lab);
    }
    // středový otvor
    float hole = smoothstep(0.03 - aaR, 0.03 + aaR, r);
    col = mix(col, vec3(0.05), (1.0 - smoothstep(0.04, 0.05, r)) * 0.6);
    acc = mix(acc, vec4(col, 1.0), inside);
    acc *= mix(1.0, hole, inside);
  }

  outColor = acc * uAlpha; // acc je po celou dobu premultiplied
}`;

export interface DiscLook {
  peaks: Uint8Array;
  main: Rgb; alt: Rgb; deep: Rgb;
  seed: number;
}

export interface DrawParams {
  /** střed a průměr desky v CSS px relativně k plátnu */
  cx: number; cy: number; size: number;
  tilt: number; spin: number; progress: number; level: number;
  alpha: number; live: number; flat: boolean; mix: number;
}

const lookCache = new Map<string, DiscLook>();
export function lookFor(beat: Pick<Beat, 'id' | 'peaks' | 'key' | 'seed'>): DiscLook {
  let l = lookCache.get(beat.id);
  if (!l) {
    const p = beatPalette(beat.key, beat.seed);
    // jen pro obraz: roztáhni dynamiku, aby tiché a hlasité pasáže byly v drážce dobře čitelné
    const raw = peaksFromBase64(beat.peaks);
    const sorted = Array.from(raw).sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.04)] ?? 0, hi = sorted[sorted.length - 1] || 1;
    const peaks = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) peaks[i] = Math.round(255 * Math.min(1, Math.max(0, (raw[i] - lo * 0.85) / Math.max(1, hi - lo * 0.85))));
    l = { peaks, main: p.main, alt: p.alt, deep: p.deep, seed: beat.seed % 100000 };
    lookCache.set(beat.id, l);
  }
  return l;
}

export class GrooveRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private tex: [WebGLTexture, WebGLTexture];
  private looks: [DiscLook | null, DiscLook | null] = [null, null];
  dpr = 1;

  static supported(): boolean {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch {
      return false;
    }
  }

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
    for (const n of ['uOrigin', 'uSize', 'uPad', 'uTilt', 'uSpin', 'uProgress', 'uLevel', 'uTurns', 'uAlpha', 'uLive', 'uFlat', 'uMix',
      'uPeaksA', 'uPeaksB', 'uMainA', 'uAltA', 'uDeepA', 'uSeedA', 'uMainB', 'uAltB', 'uDeepB', 'uSeedB']) {
      this.u[n] = gl.getUniformLocation(prog, n);
    }
    this.tex = [this.makeTex(), this.makeTex()];
    gl.uniform1i(this.u.uPeaksA, 0);
    gl.uniform1i(this.u.uPeaksB, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.SCISSOR_TEST);
  }

  private makeTex(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /** slot 0 = A (odkud), 1 = B (kam se prolíná) */
  setLook(slot: 0 | 1, look: DiscLook): void {
    if (this.looks[slot] === look) return;
    this.looks[slot] = look;
    const gl = this.gl;
    gl.activeTexture(slot === 0 ? gl.TEXTURE0 : gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[slot]);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, look.peaks.length, 1, 0, gl.RED, gl.UNSIGNED_BYTE, look.peaks);
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

  draw(p: DrawParams): void {
    if (!this.looks[0]) return;
    if (!this.looks[1]) this.setLook(1, this.looks[0]);
    const gl = this.gl;
    const pad = p.flat ? 1.02 : 1.32;
    const side = p.size * pad * this.dpr;
    const x = p.cx * this.dpr - side / 2;
    const y = this.canvas.height - p.cy * this.dpr - side / 2;
    const sx = Math.floor(x), sy = Math.floor(y), ss = Math.ceil(side) + 1;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.scissor(sx, sy, ss, ss);
    gl.uniform2f(this.u.uOrigin, x, y);
    gl.uniform1f(this.u.uSize, side);
    gl.uniform1f(this.u.uPad, pad);
    gl.uniform1f(this.u.uTilt, p.tilt);
    gl.uniform1f(this.u.uSpin, p.spin);
    gl.uniform1f(this.u.uProgress, p.progress);
    gl.uniform1f(this.u.uLevel, p.level);
    // hustota drážky podle velikosti: ~4.2 px na závit, aby byla čitelná v každém měřítku
    const bandPx = (p.size / 2) * 0.62;
    gl.uniform1f(this.u.uTurns, Math.round(Math.min(46, Math.max(7, bandPx / (p.size > 300 ? 6.2 : 4.4)))));
    gl.uniform1f(this.u.uAlpha, p.alpha);
    gl.uniform1f(this.u.uLive, p.live);
    gl.uniform1f(this.u.uFlat, p.flat ? 1 : 0);
    gl.uniform1f(this.u.uMix, p.mix);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

/* ----------------------- statické obaly do katalogu ----------------------- */

let coverRenderer: GrooveRenderer | null | undefined;
const COVER_PX = 220;

/** Vykreslí obal beatu do 2D plátna (sdílí jeden WebGL kontext pro všechny obaly). */
export function paintCover(target: HTMLCanvasElement, beat: Beat): boolean {
  if (coverRenderer === undefined) {
    try {
      const c = document.createElement('canvas');
      coverRenderer = new GrooveRenderer(c, true);
      coverRenderer.resize(COVER_PX, COVER_PX, 1);
    } catch {
      coverRenderer = null;
    }
  }
  if (!coverRenderer) return false;
  const look = lookFor(beat);
  coverRenderer.setLook(0, look);
  coverRenderer.setLook(1, look);
  coverRenderer.clear();
  coverRenderer.draw({
    cx: COVER_PX / 2, cy: COVER_PX / 2, size: COVER_PX / 1.02, tilt: 0, spin: (beat.seed % 628) / 100,
    progress: -1, level: 0, alpha: 1, live: 0, flat: true, mix: 0,
  });
  target.width = COVER_PX;
  target.height = COVER_PX;
  const ctx = target.getContext('2d');
  if (!ctx) return false;
  ctx.clearRect(0, 0, COVER_PX, COVER_PX);
  ctx.drawImage(coverRenderer.canvas, 0, 0);
  return true;
}
