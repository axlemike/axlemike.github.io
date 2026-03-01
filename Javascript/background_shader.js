(() => {
  // Simple fullscreen WebGL shader background with rotating triangle and UV debug
  const vert = `#version 300 es
  in vec2 position;
  out vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
  `;

  const frag = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 outColor;
  uniform vec2 u_res;
  uniform float u_time;
  uniform float u_enabled;

  // rotate 2D
  mat2 rot(float a){float c=cos(a), s=sin(a);return mat2(c,-s,s,c);} 

  float triSDF(vec2 p)
  {
    // equilateral triangle SDF centered at origin
    const float k = sqrt(3.0);
    p.x = abs(p.x) - 1.0;
    p.y = p.y + 1.0/k;
    if( p.x + k*p.y > 0.0 ) p = vec2(p.x - k*p.y, -k*p.x - p.y)/2.0;
    p.x -= clamp(p.x, -2.0, 2.0);
    return -length(p) * sign(p.y);
  }

  void main()
  {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(u_res.x/u_res.y, 1.0);

    // background UV debug (red/yellow checker-ish bands)
    vec2 gv = floor(uv * 8.0);
    float checker = mod(gv.x + gv.y, 2.0);
    vec3 debug = mix(vec3(1.0,0.85,0.2), vec3(1.0,0.25,0.25), checker);

    // rotating triangle
    float angle = u_time * 0.02;
    vec2 q = p * rot(angle);
    float s = triSDF(q * 3.0);
    float tri = smoothstep(0.01, -0.01, s);
    vec3 triColor = vec3(0.3, 0.6, 1.0) * (0.6 + 0.01 * sin(u_time * 20.0));

    // mix triangle over debug UVs
    vec3 col = mix(debug * 0.35, triColor, tri);

    // dark tint for readability
    col *= 0.45; // overall darkening

    // allow disabling via uniform
    col = mix(vec3(0.0), col, u_enabled);

    outColor = vec4(col, 1.0);
  }
  `;

  // Create canvas and GL context
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const gl = canvas.getContext('webgl2');
  if (!gl) return;

  let program;
  function compileShader(src, type){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      console.warn(gl.getShaderInfoLog(s));
    }
    return s;
  }

  function createProgram(){
    const v = compileShader(vert, gl.VERTEX_SHADER);
    const f = compileShader(frag, gl.FRAGMENT_SHADER);
    const p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'position');
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)){
      console.warn(gl.getProgramInfoLog(p));
    }
    return p;
  }

  program = createProgram();

  // full-screen triangle
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const pos = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pos);
  const verts = new Float32Array([-1,-1, 3,-1, -1,3]);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const u_res = gl.getUniformLocation(program, 'u_res');
  const u_time = gl.getUniformLocation(program, 'u_time');
  const u_enabled = gl.getUniformLocation(program, 'u_enabled');

  // per-page seed (bumped by navigation) to vary animation between pages
  let seed = parseInt(localStorage.getItem('bgShaderSeed') || '0', 10) || 0;

  // start time and whether the shader is enabled (default: disabled)
  let enabled = localStorage.getItem('bgShaderEnabled');
  if (enabled === null) enabled = '0';
  enabled = enabled === '1';

  // Persisted global base time (seconds) so animation phase/cycle carry across pages
  // Use a raw base time that's independent of the per-navigation `seed` so
  // rotation/pulse remain continuous even if `bgShaderSeed` is bumped.
  let start;
  const storedGlobalBaseT = parseFloat(localStorage.getItem('bgShaderGlobalT'));
  if (!isNaN(storedGlobalBaseT)) {
    start = performance.now() - storedGlobalBaseT * 1000;
  } else {
    start = performance.now();
  }

  // throttle localStorage writes
  let lastPersist = 0;

  function resize(){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    gl.viewport(0,0, w, h);
  }

  window.addEventListener('resize', resize);
  resize();

  function render(){
    // base time in seconds (raw, independent of `seed`) — keeps phase continuous
    const now = performance.now();
    const baseT = (now - start) * 0.001;
    const t = baseT;
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(u_res, canvas.width, canvas.height);
    gl.uniform1f(u_time, t);
    gl.uniform1f(u_enabled, enabled ? 1.0 : 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // persist the raw base time occasionally so next page restores the same phase
    try { if (now - lastPersist > 250) { localStorage.setItem('bgShaderGlobalT', String(t)); lastPersist = now; } } catch(e) {}
    requestAnimationFrame(render);
  }

  // Hook toggle
  const toggle = document.getElementById('bg-toggle');
  function updateToggle(){
    if(!toggle) return;
    toggle.textContent = enabled ? 'Disable background' : 'Enable background';
  }
  updateToggle();
  if(toggle){
    toggle.addEventListener('click', ()=>{
      enabled = !enabled;
      localStorage.setItem('bgShaderEnabled', enabled ? '1' : '0');
      canvas.style.display = enabled ? 'block' : 'none';
      const overlay = document.getElementById('bg-overlay');
      if(overlay) overlay.style.display = enabled ? 'block' : 'none';
      updateToggle();
    });
  }

  // initialize visibility
  canvas.style.display = enabled ? 'block' : 'none';
  const overlayEl = document.getElementById('bg-overlay');
  if(overlayEl) overlayEl.style.display = enabled ? 'block' : 'none';

  requestAnimationFrame(render);

})();
