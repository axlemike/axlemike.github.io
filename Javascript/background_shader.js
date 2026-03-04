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

  float triSDF(vec2 p){
    // equilateral triangle SDF centered at origin
    const float k = sqrt(3.0);
    p.x = abs(p.x) - 1.0;
    p.y = p.y + 1.0/k;
    if( p.x + k*p.y > 0.0 ) p = vec2(p.x - k*p.y, -k*p.x - p.y)/2.0;
    p.x -= clamp(p.x, -2.0, 2.0);
    return -length(p)*sign(p.y);
  }

  void main()
  {
    vec2 uv = vUv;
    float aspectRatio = u_res.x / u_res.y;
    vec2 p = (uv - 0.5) * vec2(aspectRatio, 1.0);

    // background UV debug (red/yellow checker-ish bands), apply aspect ratio to keep squares, and animate with time for visual interest
    vec2 uvAspect = uv * vec2(aspectRatio, 1.0);
    vec2 gv = floor(uvAspect * 8.0 + (u_time * 0.03) * vec2(-1.0, 1.0));
    float checker = mod(gv.x + gv.y, 2.0);
    //vec3 debug = mix(vec3(1.0, 0.85, 0.2), vec3(1.0, 0.25, 0.25), checker);
    vec3 debug = mix(vec3(0.7, 0.7, 0.7), vec3(0.0, 0.0, 0.0), checker);


    // rotating triangle
    float angle = u_time * 0.02;
    vec2 q = p * rot(angle);
    float s = triSDF(q * 2.3);
    float tri = smoothstep(0.01, -0.01, s);
    
    //vec3 triColor = vec3(0.3, 0.6, 1.0) * (0.6 + 0.2 * sin(u_time * 0.2));

    // Display the barycentric coordinates as color for fun visual interest
    // Compute barycentric coordinates for the triangle
    vec3 bary;
    float k = sqrt(3.0);
    vec2 v0 = vec2(0.0, 2.0 / k);
    vec2 v1 = vec2(-1.0, -1.0 / k);
    vec2 v2 = vec2(1.0, -1.0 / k);
    float area = 0.5 * k; // Area of the equilateral triangle
    float a = 0.5 * k * length(cross(vec3(v1 - v0, 0.0), vec3(p - v0, 0.0)));
    float b = 0.5 * k * length(cross(vec3(v2 - v1, 0.0), vec3(p - v1, 0.0)));
    float c = 0.5 * k * length(cross(vec3(v0 - v2, 0.0), vec3(p - v2, 0.0)));
    bary = vec3(a, b, c) / area;
    vec3 triColor = bary * (0.2 + 0.1 * sin(u_time * 0.2));

    // mix triangle over debug UVs
    vec3 color = mix(debug * 0.15, triColor, tri);

    // dark tint for readability
    //color *= 0.65; // overall darkening

    // allow disabling via uniform
    color = mix(vec3(0.0), color, u_enabled);

    outColor = vec4(color, 1.0);
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

  // start time and whether the shader is enabled (default: enabled)
  let start = performance.now();
  let enabled = localStorage.getItem('bgShaderEnabled');
  if (enabled === null) {
    enabled = '1';
    localStorage.setItem('bgShaderEnabled', '1');
  }
  enabled = enabled === '1';

  // persistent global start time so animation continues across page loads
  let globalStart = parseInt(localStorage.getItem('bgShaderGlobalStart') || '0', 10) || 0;
  if (!globalStart) {
    globalStart = Date.now();
    localStorage.setItem('bgShaderGlobalStart', String(globalStart));
  }

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
    // compute time relative to a persistent global start so pages stay in-phase
    const t = (Date.now() - globalStart) * 0.001;
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(u_res, canvas.width, canvas.height);
    gl.uniform1f(u_time, t);
    gl.uniform1f(u_enabled, enabled ? 1.0 : 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
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
