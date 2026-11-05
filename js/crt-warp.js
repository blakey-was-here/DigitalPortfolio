/* CRT warp background: plain-JS port of the CRTWarp React component.
   Usage: add <div class="hero-bg" data-crt-warp aria-hidden="true"></div> inside any
   position:relative container. Override options per element with
   data-crt-options='{"speed":0.3,"color":"#E0525C"}'. */
(function () {
  'use strict';

  var CANVAS = 'crt-warp-canvas';
  var MASKS = { none: 0, aperture: 1, shadow: 2, slot: 3 };
  var CELL_ASPECT = 0.56;
  var INTRO_SECONDS = 1.6;
  var FLIP_SECONDS = 0.8;
  var TAU = Math.PI * 2;

  /* Site-tuned defaults: wine + purple blend on the site's own background. */
  var DEFAULTS = {
    color: '#D353A9',            /* #E0525C (accent) mixed 50/50 with #c755f7 */
    backgroundColor: '#1A0F12',  /* same as --bg, so edges blend into the page */
    lightMode: false,
    speed: 0.45,
    variation: 0,
    waveAmplitude: 0.3,
    waveFrequency: 2.5,
    levels: 3,
    columns: 140,
    persistence: 0.4,
    curvature: 0.15,
    corners: 0,
    scanlineStrength: 0.6,
    scanlineFrequency: 180,
    mask: 'aperture',
    maskStrength: 0.3,
    bloom: 1.3,
    bloomRadius: 1,
    rgbShift: 0.003,
    noise: 0.1,
    flicker: 0.12,
    interference: 0.2,
    vignette: 0.45,
    brightness: 0.8,
    intro: true,
    mouseReact: true,
    mouseStrength: 0.5,
    changeOnClick: true,
    dpr: 1.5,
    fps: 60,
    paused: false
  };

  var VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  var CONTENT = `#version 300 es
precision highp float;
uniform vec2 uGrid;
uniform float uTime;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uLevels;
uniform float uDecay;
uniform float uReveal;
uniform float uRise;
uniform vec4 uSeed;
uniform sampler2D uPrevious;
out vec4 outColor;

float field(vec2 uv, float t) {
  uv = (uv - 0.5) * uFrequency + 0.5;
  float f = 0.0;
  f += 0.7 * sin(0.5 * uv.x + t / 5.0 + uSeed.x);
  f += 3.0 * sin(1.6 * uv.y + t / 5.0 + uSeed.y);
  f += sin(10.0 * (uv.y * sin(t / 2.0 + uSeed.z) + uv.x * cos(t / 5.0)) + t / 2.0);
  float cx = uv.x + 0.5 * sin(t / 2.0 + uSeed.w);
  float cy = uv.y + 0.5 * cos(t / 4.0 + uSeed.x * 0.7);
  f += 0.4 * sin(sqrt(100.0 * cx * cx + 100.0 * cy * cy + 1.0) + t);
  f += 0.9 * sin(sqrt(75.0 * cx * cx + 25.0 * cy * cy + 1.0) + t);
  f -= 1.4 * sin(sqrt(256.0 * cx * cx + 25.0 * cy * cy + 1.0) + t);
  f += 0.3 * sin(0.5 * uv.y + uv.x + sin(t));
  return f;
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 uv = (cell + 0.5) / uGrid;
  float s = (0.5 + 0.499 * sin(field(uv, uTime) * uAmplitude)) * mix(1.0 / uLevels, 1.0, uReveal);
  float level = floor(s * uLevels) / max(uLevels - 1.0, 1.0);
  float previous = texelFetch(uPrevious, ivec2(cell), 0).r;
  float lifted = min(level, previous + uRise);
  outColor = vec4(max(lifted, previous * uDecay - 0.004), level, 0.0, 1.0);
}`;

  var GLOW = `#version 300 es
precision highp float;
uniform sampler2D uContent;
uniform vec2 uSize;
out vec4 outColor;

void main() {
  float v = texture(uContent, gl_FragCoord.xy / uSize).r;
  outColor = vec4(v * v, 0.0, 0.0, 1.0);
}`;

  var BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uSize;
uniform vec2 uDirection;
uniform float uSigma;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float stride = max(uSigma * 0.55, 0.5);
  float total = 0.0;
  float sum = 0.0;
  for (int i = -7; i <= 7; i++) {
    float x = float(i) * stride;
    float w = exp(-0.5 * x * x / (uSigma * uSigma));
    sum += texture(uSource, uv + uDirection * x / uSize).r * w;
    total += w;
  }
  outColor = vec4(sum / total, 0.0, 0.0, 1.0);
}`;

  var DISPLAY = `#version 300 es
precision highp float;
uniform sampler2D uContent;
uniform sampler2D uGlow;
uniform vec2 uGrid;
uniform vec2 uResolution;
uniform float uPixel;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uBackground;
uniform float uOpaque;
uniform float uLight;
uniform float uLines;
uniform float uScanline;
uniform float uCurve;
uniform float uCorners;
uniform int uMaskType;
uniform float uMask;
uniform float uBloom;
uniform float uBrightness;
uniform float uNoise;
uniform float uFlicker;
uniform float uInterference;
uniform float uVignette;
uniform float uShift;
uniform float uWarm;
uniform float uFocus;
uniform float uStatic;
uniform float uRoll;
uniform float uTear;
uniform float uGain;
uniform vec4 uMagnet;
uniform float uPurity;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 curve(vec2 uv) {
  if (uCurve <= 0.0) return uv;
  vec2 p = (uv - 0.5) * 2.0;
  float corner = uCurve / sqrt(max(uCurve * uCurve - 2.0, 0.001));
  p = uCurve * p / sqrt(max(uCurve * uCurve - dot(p, p), 0.001));
  p /= corner;
  return p * 0.5 + 0.5;
}

float lineValue(float x, float y) {
  if (x < 0.0 || x > 1.0 || y < 0.0 || y > 1.0) return 0.0;
  float cx = x * uGrid.x - 0.5;
  float c0 = floor(cx);
  int row = int(clamp(floor(y * uGrid.y), 0.0, uGrid.y - 1.0));
  float a = texelFetch(uContent, ivec2(int(clamp(c0, 0.0, uGrid.x - 1.0)), row), 0).r;
  float b = texelFetch(uContent, ivec2(int(clamp(c0 + 1.0, 0.0, uGrid.x - 1.0)), row), 0).r;
  float soft = mix(0.5, 0.14, uFocus);
  return pow(mix(a, b, smoothstep(0.5 - soft, 0.5 + soft, cx - c0)), 1.25);
}

float beam(vec2 uv) {
  float ly = uv.y * uLines - 0.5;
  float r0 = floor(ly);
  float f = ly - r0;
  float a = lineValue(uv.x, (r0 + 0.5) / uLines);
  float b = lineValue(uv.x, (r0 + 1.5) / uLines);
  float nearest = f < 0.5 ? a : b;
  float sa = mix(0.16, 0.34, sqrt(a));
  float sb = mix(0.16, 0.34, sqrt(b));
  float lit = a * exp(-0.5 * f * f / (sa * sa)) + b * exp(-0.5 * (1.0 - f) * (1.0 - f) / (sb * sb));
  return mix(nearest, lit * 1.18, uScanline * mix(0.3, 1.0, uFocus));
}

vec3 maskAt(vec2 px) {
  if (uMaskType == 0 || uMask <= 0.0) return vec3(1.0);
  float size = max(1.0, floor(uPixel + 0.5));
  vec2 q = floor(px / size);
  float low = 1.0 - uMask;
  vec3 m = vec3(low);
  float column = q.x;
  if (uMaskType == 2) column += mod(floor(q.y / 2.0), 2.0) * 1.5;
  int stripe = int(mod(floor(column), 3.0));
  if (stripe == 0) m.r = 1.0;
  else if (stripe == 1) m.g = 1.0;
  else m.b = 1.0;
  if (uMaskType == 2 && mod(q.y, 2.0) > 0.5) m *= mix(1.0, 0.72, uMask);
  if (uMaskType == 3) {
    float slot = mod(q.y + mod(floor(q.x / 3.0), 2.0) * 2.0, 4.0);
    if (slot < 1.0) m *= mix(1.0, 0.45, uMask);
  }
  return m / sqrt((1.0 + 2.0 * low) / 3.0);
}

vec3 phosphor(vec3 cov) {
  float peak = max(max(uColor.r, uColor.g), max(uColor.b, 0.001));
  vec3 weight = 1.0 - uColor / peak;
  return uColor * cov * pow(max(cov, vec3(0.0001)), 0.7 * weight);
}

void main() {
  vec2 frag = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = curve(frag);
  float shape = 1.0;
  if (uCorners > 0.0) {
    float margin = uCorners * 0.035;
    float radius = uCorners * 0.1;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    vec2 box = (0.5 - margin) * vec2(aspect, 1.0);
    vec2 q = abs(p) - box + radius;
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    float aa = max(fwidth(sd), 0.0005);
    shape = (1.0 - smoothstep(-aa, aa, sd)) * mix(1.0, smoothstep(0.0, 0.06, -sd), 0.35);
    uv = (uv - 0.5) / (1.0 - 2.0 * margin) + 0.5;
  }
  float rolling = step(0.0001, abs(uRoll));
  uv.y += uRoll;
  float wrapped = fract(uv.y);
  uv.y = mix(uv.y, wrapped, rolling);
  float offset = fract(uRoll);
  float reach = smoothstep(0.0, 0.08, min(offset, 1.0 - offset));
  float blank = mix(1.0, smoothstep(0.0, 0.05, wrapped) * smoothstep(1.0, 0.95, wrapped), rolling * reach);

  float line = floor(uv.y * uLines);
  float tick = floor(uTime * 30.0);
  uv.x += uTear * (sin(uv.y * 21.0 + uTime * 37.0) * 0.6 + hash(vec2(line, tick)) - 0.5) * 0.05;
  uv.x += uInterference * 0.003 * (hash(vec2(line * 0.37, floor(uTime * 24.0))) - 0.5);

  vec2 dp = (frag - uMagnet.xy) * vec2(aspect, 1.0);
  float fall = exp(-dot(dp, dp) / max(uMagnet.w * uMagnet.w, 0.0001));
  vec2 swirl = vec2(-dp.y, dp.x) / vec2(aspect, 1.0) * fall * uMagnet.z * 0.5;
  vec3 spread = mix(vec3(0.85), vec3(1.0, 0.6, 0.2), uPurity);

  vec3 level = vec3(
    beam(uv + swirl * spread.r + vec2(uShift, 0.0)),
    beam(uv + swirl * spread.g),
    beam(uv + swirl * spread.b - vec2(uShift, 0.0))
  );

  float turn = uTime * 0.35;
  vec2 axis = vec2(cos(turn), sin(turn));
  float lobe = dot(dp, axis) / max(uMagnet.w, 0.0001);
  float side = dot(dp, vec2(-axis.y, axis.x)) / max(uMagnet.w, 0.0001);
  vec3 purity = vec3(lobe, -0.35 * lobe + 0.6 * side, -lobe);
  level *= 1.0 + uPurity * fall * uMagnet.z * 0.9 * purity;

  float glow = texture(uGlow, uv).r * uBloom;
  float hum = 1.0 - uInterference * 0.24 * smoothstep(0.2, 1.0, 0.5 + 0.5 * sin((frag.y - uTime * 0.09) * 6.2831853));
  float flick = 1.0 + uFlicker * 0.1 * (hash(vec2(floor(uTime * 60.0), 7.3)) - 0.5);
  float grain = hash(gl_FragCoord.xy + fract(uTime) * 173.0) - 0.5;
  vec2 v = frag - 0.5;
  float vignette = mix(1.0, smoothstep(0.0, 1.0, clamp(1.0 - dot(v, v) * 2.0, 0.0, 1.0)), uVignette);
  float gain = uBrightness * hum * flick * vignette * blank * uGain * uWarm;

  float noise = hash(floor(gl_FragCoord.xy / (uPixel * 1.5)) + fract(uTime * 13.7) * 91.0);
  level = mix(level, vec3(noise * noise * 1.15), uStatic);
  level *= gain * (1.0 + grain * uNoise * 2.0);
  level *= maskAt(gl_FragCoord.xy);
  glow *= gain * shape * (1.0 + 0.6 * (1.0 - uFocus));
  level *= shape;

  vec3 color;
  float alpha;
  if (uLight < 0.5) {
    vec3 cov = clamp(level, 0.0, 1.0);
    vec3 light = phosphor(cov) + uColor * glow * 0.5 * (1.0 - cov);
    vec3 excess = max(level - 1.1, 0.0);
    light += (1.0 - light) * (1.0 - exp(-excess * 0.6));
    light = clamp(light, 0.0, 1.0);
    color = uBackground + light * (1.0 - uBackground);
    alpha = max(max(light.r, light.g), light.b);
    if (uOpaque < 0.5) color = light;
  } else {
    vec3 cov = clamp(level * 0.86, 0.0, 0.88);
    cov += clamp(glow * 0.12, 0.0, 0.2) * (1.0 - cov);
    color = mix(uBackground, uColor, cov);
    alpha = max(max(cov.r, cov.g), cov.b);
    if (uOpaque < 0.5) color = uColor * cov;
  }
  outColor = uOpaque > 0.5 ? vec4(color, 1.0) : vec4(color, alpha);
}`;

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  var probe = null;
  function parseColor(value, fallback) {
    if (value === 'transparent') return null;
    if (!probe) probe = document.createElement('canvas').getContext('2d');
    if (!probe) return fallback;
    probe.fillStyle = '#000000';
    probe.fillStyle = value;
    var text = probe.fillStyle;
    if (text.charAt(0) === '#') {
      var hex = parseInt(text.slice(1), 16);
      return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
    }
    var match = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(text);
    if (!match) return fallback;
    if (match[4] !== undefined && Number(match[4]) === 0) return null;
    return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
  }

  function seedFor(channel) {
    var a = Math.sin(channel * 12.9898 + 1.7) * 43758.5453;
    var b = Math.sin(channel * 78.233 + 4.1) * 24634.6345;
    var c = Math.sin(channel * 37.719 + 2.9) * 17431.7731;
    var d = Math.sin(channel * 91.113 + 0.3) * 31337.1337;
    var f = function (v) { return (v - Math.floor(v)) * TAU; };
    return channel === 0 ? [0, 0, 0, 0] : [f(a), f(b), f(c), f(d)];
  }

  function introAt(t) {
    if (t >= INTRO_SECONDS) return [1, 1, 1];
    var reveal = smooth(clamp(t / INTRO_SECONDS, 0, 1));
    var warm = smooth(clamp(t / 0.6, 0, 1));
    var focus = smooth(clamp((t - 0.15) / (INTRO_SECONDS - 0.15), 0, 1));
    return [reveal, warm, focus];
  }

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, fragment, names) {
    var vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    var shader = compile(gl, gl.FRAGMENT_SHADER, fragment);
    if (!vertex || !shader) return null;
    var program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, shader);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(shader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    var uniforms = {};
    names.forEach(function (name) { uniforms[name] = gl.getUniformLocation(program, name); });
    return { program: program, uniforms: uniforms };
  }

  function createTarget(gl, width, height) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture: texture, framebuffer: framebuffer, width: width, height: height };
  }

  function deleteTarget(gl, target) {
    if (!target) return;
    gl.deleteTexture(target.texture);
    gl.deleteFramebuffer(target.framebuffer);
  }

  function prefersReduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function buildSettings(o) {
    var ink = parseColor(o.color, [0.78, 0.33, 0.97]) || [0.78, 0.33, 0.97];
    var paper = parseColor(o.backgroundColor, [0.07, 0.06, 0.09]);
    return {
      ink: ink,
      paper: paper,
      lightMode: o.lightMode,
      speed: o.speed,
      variation: o.variation,
      amplitude: Math.max(0, o.waveAmplitude) / 0.28,
      frequency: Math.max(0.01, o.waveFrequency) / 2.2,
      levels: clamp(Math.round(o.levels), 2, 12),
      columns: clamp(Math.round(o.columns), 8, 400),
      persistence: clamp(o.persistence, 0, 0.98),
      curve: o.curvature > 0.001 ? 1.1 + 0.42 / o.curvature : 0,
      corners: clamp(o.corners, 0, 1),
      scanline: clamp(o.scanlineStrength, 0, 1),
      lines: clamp(o.scanlineFrequency, 20, 1200),
      mask: MASKS[o.mask] !== undefined ? MASKS[o.mask] : 0,
      maskStrength: clamp(o.maskStrength, 0, 1),
      bloom: Math.max(0, o.bloom),
      bloomRadius: Math.max(0.05, o.bloomRadius),
      rgbShift: o.rgbShift,
      noise: Math.max(0, o.noise),
      flicker: Math.max(0, o.flicker),
      interference: Math.max(0, o.interference),
      vignette: clamp(o.vignette, 0, 1),
      brightness: Math.max(0, o.brightness),
      intro: o.intro,
      mouseReact: o.mouseReact,
      mouseStrength: Math.max(0, o.mouseStrength),
      changeOnClick: o.changeOnClick,
      dpr: Math.max(0.5, o.dpr),
      fps: Math.max(1, o.fps),
      paused: o.paused
    };
  }

  function CRTWarp(container, userOptions) {
    var options = Object.assign({}, DEFAULTS, userOptions || {});
    var settings = buildSettings(options);

    var canvas = document.createElement('canvas');
    canvas.className = CANVAS;
    container.appendChild(canvas);
    var gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });
    if (!gl) {
      canvas.remove();
      return { update: function () {}, destroy: function () {} };
    }

    var content = createProgram(gl, CONTENT, ['uGrid', 'uTime', 'uAmplitude', 'uFrequency', 'uLevels', 'uDecay', 'uReveal', 'uRise', 'uSeed', 'uPrevious']);
    var glowSource = createProgram(gl, GLOW, ['uContent', 'uSize']);
    var blur = createProgram(gl, BLUR, ['uSource', 'uSize', 'uDirection', 'uSigma']);
    var display = createProgram(gl, DISPLAY, ['uContent', 'uGlow', 'uGrid', 'uResolution', 'uPixel', 'uTime', 'uColor', 'uBackground', 'uOpaque', 'uLight', 'uLines', 'uScanline', 'uCurve', 'uCorners', 'uMaskType', 'uMask', 'uBloom', 'uBrightness', 'uNoise', 'uFlicker', 'uInterference', 'uVignette', 'uShift', 'uWarm', 'uFocus', 'uStatic', 'uRoll', 'uTear', 'uGain', 'uMagnet', 'uPurity']);
    if (!content || !glowSource || !blur || !display) {
      canvas.remove();
      return { update: function () {}, destroy: function () {} };
    }

    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var state = {
      width: 1, height: 1, pixel: 1,
      grid: [0, 0], cells: [null, null], glows: [null, null],
      flip: 0, time: 0, clock: 0, last: 0, raf: 0,
      visible: false,
      introAt: -1, flipAt: -1, flipped: true, channel: 0,
      pointer: [0.5, 0.5],
      magnet: [0.5, 0.5, 0, 0, 0],
      magnetGoal: 0,
      lost: false, quiet: 0, seen: null
    };

    function ensureTargets() {
      var s = settings;
      var cols = s.columns;
      var rows = clamp(Math.round((cols * CELL_ASPECT * state.height) / Math.max(state.width, 1)), 4, 300);
      if (cols !== state.grid[0] || rows !== state.grid[1]) {
        state.cells.forEach(function (t) { deleteTarget(gl, t); });
        state.cells = [createTarget(gl, cols, rows), createTarget(gl, cols, rows)];
        state.grid = [cols, rows];
      }
      var gw = Math.max(1, Math.round(state.width / 4));
      var gh = Math.max(1, Math.round(state.height / 4));
      var glow = state.glows[0];
      if (!glow || glow.width !== gw || glow.height !== gh) {
        state.glows.forEach(function (t) { deleteTarget(gl, t); });
        state.glows = [createTarget(gl, gw, gh), createTarget(gl, gw, gh)];
      }
    }

    function resize() {
      var ratio = Math.min(window.devicePixelRatio || 1, settings.dpr);
      var width = Math.max(1, Math.round(container.clientWidth * ratio));
      var height = Math.max(1, Math.round(container.clientHeight * ratio));
      state.pixel = ratio;
      if (width === state.width && height === state.height) return;
      state.quiet = 0;
      state.width = width;
      state.height = height;
      canvas.width = width;
      canvas.height = height;
    }

    function draw(target, width, height) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
      gl.viewport(0, 0, width, height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function bindTexture(unit, texture, location) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(location, unit);
    }

    function render(dt, reduced) {
      var s = settings;
      ensureTargets();
      var cols = state.grid[0], rows = state.grid[1];
      var seed = seedFor(s.variation + state.channel);
      var introClock = state.introAt < 0 ? 0 : state.clock - state.introAt;
      var intro = s.intro && !reduced ? introAt(introClock) : [1, 1, 1];
      var reveal = intro[0], warm = intro[1], focus = intro[2];

      var previous = state.cells[state.flip];
      var next = state.cells[1 - state.flip];
      var glowA = state.glows[0], glowB = state.glows[1];
      if (!previous || !next || !glowA || !glowB) return;

      gl.useProgram(content.program);
      gl.uniform2f(content.uniforms.uGrid, cols, rows);
      gl.uniform1f(content.uniforms.uTime, state.time);
      gl.uniform1f(content.uniforms.uAmplitude, s.amplitude);
      gl.uniform1f(content.uniforms.uFrequency, s.frequency);
      gl.uniform1f(content.uniforms.uLevels, s.levels);
      gl.uniform1f(content.uniforms.uDecay, reduced ? 0 : Math.pow(s.persistence, dt * 60));
      gl.uniform1f(content.uniforms.uReveal, reveal);
      gl.uniform1f(content.uniforms.uRise, reveal < 1 ? dt / 0.22 : 1);
      gl.uniform4f(content.uniforms.uSeed, seed[0], seed[1], seed[2], seed[3]);
      bindTexture(0, previous.texture, content.uniforms.uPrevious);
      draw(next, cols, rows);
      state.flip = 1 - state.flip;

      gl.useProgram(glowSource.program);
      gl.uniform2f(glowSource.uniforms.uSize, glowA.width, glowA.height);
      bindTexture(0, next.texture, glowSource.uniforms.uContent);
      draw(glowA, glowA.width, glowA.height);
      var sigma = Math.max(0.6, (glowA.height / 48) * s.bloomRadius);
      gl.useProgram(blur.program);
      gl.uniform2f(blur.uniforms.uSize, glowA.width, glowA.height);
      gl.uniform1f(blur.uniforms.uSigma, sigma);
      gl.uniform2f(blur.uniforms.uDirection, 1, 0);
      bindTexture(0, glowA.texture, blur.uniforms.uSource);
      draw(glowB, glowB.width, glowB.height);
      gl.uniform2f(blur.uniforms.uDirection, 0, 1);
      bindTexture(0, glowB.texture, blur.uniforms.uSource);
      draw(glowA, glowA.width, glowA.height);

      var roll = 0, tear = 0, staticNoise = 0, gain = 1;
      if (state.flipAt >= 0) {
        var t = state.clock - state.flipAt;
        if (!state.flipped && t >= 0.22) {
          state.flipped = true;
          state.channel += 1;
        }
        if (t >= FLIP_SECONDS) {
          state.flipAt = -1;
        } else {
          var p = t / FLIP_SECONDS;
          roll = easeInOut(p);
          tear = Math.sin(Math.PI * clamp(t / 0.5, 0, 1)) * 0.6;
          staticNoise = Math.sin(Math.PI * clamp(t / 0.55, 0, 1)) * 0.75;
          gain = 1 - 0.3 * Math.sin(Math.PI * p);
        }
      }

      gl.useProgram(display.program);
      var u = display.uniforms;
      bindTexture(0, next.texture, u.uContent);
      bindTexture(1, glowA.texture, u.uGlow);
      gl.uniform2f(u.uGrid, cols, rows);
      gl.uniform2f(u.uResolution, state.width, state.height);
      gl.uniform1f(u.uPixel, state.pixel);
      gl.uniform1f(u.uTime, reduced ? 0 : state.clock);
      gl.uniform3f(u.uColor, s.ink[0], s.ink[1], s.ink[2]);
      var paperColor = s.paper || [0, 0, 0];
      gl.uniform3f(u.uBackground, paperColor[0], paperColor[1], paperColor[2]);
      gl.uniform1f(u.uOpaque, s.paper ? 1 : 0);
      gl.uniform1f(u.uLight, s.lightMode ? 1 : 0);
      gl.uniform1f(u.uLines, s.lines);
      gl.uniform1f(u.uScanline, s.scanline);
      gl.uniform1f(u.uCurve, s.curve);
      gl.uniform1f(u.uCorners, s.corners);
      gl.uniform1i(u.uMaskType, s.mask);
      gl.uniform1f(u.uMask, s.maskStrength);
      gl.uniform1f(u.uBloom, s.bloom);
      gl.uniform1f(u.uBrightness, s.brightness);
      gl.uniform1f(u.uNoise, s.noise);
      gl.uniform1f(u.uFlicker, reduced ? 0 : s.flicker);
      gl.uniform1f(u.uInterference, s.interference);
      gl.uniform1f(u.uVignette, s.vignette);
      gl.uniform1f(u.uShift, s.rgbShift);
      gl.uniform1f(u.uWarm, warm);
      gl.uniform1f(u.uFocus, focus);
      gl.uniform1f(u.uStatic, staticNoise);
      gl.uniform1f(u.uRoll, roll);
      gl.uniform1f(u.uTear, tear);
      gl.uniform1f(u.uGain, gain);
      gl.uniform4f(u.uMagnet, state.magnet[0], 1 - state.magnet[1], state.magnet[4] * s.mouseStrength * 2, 0.24);
      gl.uniform1f(u.uPurity, s.mask > 0 ? 1 : 0);
      draw(null, state.width, state.height);
    }

    function tick(now) {
      state.raf = requestAnimationFrame(tick);
      if (!state.visible || document.hidden || state.lost) {
        state.last = now;
        return;
      }
      var s = settings;
      var interval = 1000 / s.fps;
      if (state.last && now - state.last < interval - 1) return;
      var dt = state.last ? Math.min((now - state.last) / 1000, 0.1) : 1 / 60;
      state.last = now;
      var reduced = prefersReduced();
      state.clock += dt;
      if (state.introAt < 0) state.introAt = state.clock;
      if (!s.paused && !reduced) state.time += dt * s.speed;

      var m = state.magnet;
      var omega = TAU / 0.3;
      for (var i = 0; i < 2; i++) {
        var accel = -omega * omega * (m[i] - state.pointer[i]) - 2 * omega * m[2 + i];
        m[2 + i] += accel * dt;
        m[i] += m[2 + i] * dt;
      }
      var goal = s.mouseReact && !reduced ? state.magnetGoal : 0;
      m[4] += (goal - m[4]) * (1 - Math.exp(-dt / 0.18));

      var still = s.paused || reduced;
      var settling =
        Math.abs(m[4] - goal) > 0.002 ||
        (m[4] > 0.002 && (Math.abs(m[2]) + Math.abs(m[3]) > 0.0005 || Math.abs(m[0] - state.pointer[0]) > 0.0005));
      var transient =
        state.flipAt >= 0 || (s.intro && !reduced && state.clock - state.introAt < INTRO_SECONDS) || settling;
      if (state.seen !== s || transient || !still) state.quiet = 0;
      else state.quiet += 1;
      state.seen = s;
      if (state.quiet > 90) return;

      resize();
      render(dt, reduced);
    }

    function local(event) {
      var rect = container.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / Math.max(rect.width, 1),
        y: (event.clientY - rect.top) / Math.max(rect.height, 1),
        inside:
          event.clientX >= rect.left && event.clientX <= rect.right &&
          event.clientY >= rect.top && event.clientY <= rect.bottom
      };
    }

    function onMove(event) {
      var point = local(event);
      if (point.inside) {
        if (state.magnetGoal === 0 && state.magnet[4] < 0.02) {
          state.magnet[0] = point.x;
          state.magnet[1] = point.y;
          state.magnet[2] = 0;
          state.magnet[3] = 0;
        }
        state.pointer = [point.x, point.y];
      }
      state.magnetGoal = point.inside ? 1 : 0;
    }

    function onLeave() { state.magnetGoal = 0; }

    function onDown(event) {
      if (!settings.changeOnClick || event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest('a, button, input, textarea, select, label, [role="button"]')) return;
      var point = local(event);
      if (!point.inside) return;
      if (prefersReduced()) { state.channel += 1; return; }
      if (state.flipAt >= 0) return;
      state.flipAt = state.clock;
      state.flipped = false;
    }

    function onLost(event) {
      event.preventDefault();
      state.lost = true;
    }

    var visibility = new IntersectionObserver(function (entries) {
      state.visible = entries.some(function (e) { return e.isIntersecting; });
    });
    visibility.observe(container);
    var sizes = new ResizeObserver(resize);
    sizes.observe(container);
    resize();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    document.documentElement.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('webglcontextlost', onLost);
    state.raf = requestAnimationFrame(tick);

    return {
      update: function (next) {
        options = Object.assign({}, options, next || {});
        settings = buildSettings(options);
      },
      destroy: function () {
        cancelAnimationFrame(state.raf);
        visibility.disconnect();
        sizes.disconnect();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerdown', onDown);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('webglcontextlost', onLost);
        state.cells.forEach(function (t) { deleteTarget(gl, t); });
        state.glows.forEach(function (t) { deleteTarget(gl, t); });
        [content, glowSource, blur, display].forEach(function (item) { gl.deleteProgram(item.program); });
        gl.deleteBuffer(buffer);
        gl.deleteVertexArray(vao);
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
        canvas.remove();
      }
    };
  }

  window.CRTWarp = CRTWarp;

  function init() {
    document.querySelectorAll('[data-crt-warp]').forEach(function (el) {
      var opts = {};
      try { opts = JSON.parse(el.getAttribute('data-crt-options') || '{}'); } catch (e) { opts = {}; }
      /* fewer columns on phones: chunkier pixels, lighter on the GPU */
      if (opts.columns == null && window.innerWidth < 760) opts.columns = 60;
      CRTWarp(el, opts);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
