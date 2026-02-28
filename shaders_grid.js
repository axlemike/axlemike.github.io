/* shaders_grid.js
   Deferred shader grid: click-to-run previews with overlay.
   - Shows a grid of shaders parsed from shaders_public.json
   - Detects shaders that require external resources (iChannels, buffers) and opens Shadertoy page instead
   - Defers compilation until user interaction; overlay enlarges shader when opened
*/
(function(){
    var MAX = 12;
    var PRE_W = 320, PRE_H = 180;
    var OVERLAY_W = 900, OVERLAY_H = 506;
    var offlineMode = (location.protocol === 'file:');
    var activePreview = null; // { card, thumb, canvas, previewGL, io, overlayEl, staticImg }

    function stopActivePreview(preserveLastFrame){
        if (!activePreview) return;
        try {
            // if requested, capture last frame and replace canvas with an <img>
            if (preserveLastFrame && activePreview.canvas && activePreview.previewGL) {
                try {
                    var canvas = activePreview.canvas;
                    var data = canvas.toDataURL('image/png');
                    var img = document.createElement('img');
                    img.className = 'shader-thumb-static';
                    img.src = data;
                    img.style.width = canvas.style.width || '100%';
                    img.style.height = canvas.style.height || canvas.height + 'px';
                    // replace canvas with image in thumb
                    if (canvas.parentNode) canvas.parentNode.replaceChild(img, canvas);
                    // create a small restart/play button overlay on the static image
                    try {
                        var play2 = document.createElement('button'); play2.className = 'shader-play'; play2.textContent = '▶';
                        // when clicked, restart preview and open overlay
                        play2.addEventListener('click', function(ev){ ev.stopPropagation(); if (activePreview && activePreview.card && typeof activePreview.card._startPreview === 'function') { activePreview.card._startPreview(); activePreview.card._openOverlay(); } });
                        if (img.parentNode) img.parentNode.appendChild(play2);
                    } catch (e) {}
                    activePreview.staticImg = img;
                } catch (e) { /* ignore capture errors */ }
            }
        } catch (e) {}

        try { if (activePreview.previewGLThumb && activePreview.previewGLThumb.stop) activePreview.previewGLThumb.stop(); } catch(e){}
        try { if (activePreview.overlayPreview && activePreview.overlayPreview.stop) activePreview.overlayPreview.stop(); } catch(e){}
        try { if (activePreview.io && activePreview.io.disconnect) activePreview.io.disconnect(); } catch(e){}
        try { if (activePreview.overlayEl && activePreview.overlayEl.parentNode) activePreview.overlayEl.parentNode.removeChild(activePreview.overlayEl); } catch(e){}
        try {
            // also remove any lingering overlays created by other modules (ThreeOverlay)
            var overlays = document.querySelectorAll && document.querySelectorAll('.shader-overlay');
            if (overlays && overlays.length) overlays.forEach(function(o){ try { if (o._threeCleanup) { o._threeCleanup(); } else if (o.parentNode) { o.parentNode.removeChild(o); } } catch(e){} });
        } catch(e){}
        // do not remove staticImg; leave it visible
        // preserve card and thumb so the static image can restart the preview
        var keepImg = activePreview.staticImg || null;
        var keepCard = activePreview.card || null;
        var keepThumb = activePreview.thumb || null;
        activePreview = null;
        if (keepImg) activePreview = { card: keepCard, thumb: keepThumb, staticImg: keepImg };
    }

    // stop preview when clicking outside the active card or on the overlay background
    document.addEventListener('click', function(e){
        if (!activePreview || !activePreview.card) return;
        var overlay = activePreview.overlayEl;
        // If overlay is present, clicking the overlay background (the overlay element itself) should close everything.
        if (overlay) {
            if (overlay === e.target) { stopActivePreview(false); e.stopPropagation(); e.preventDefault(); return; }
            // clicks inside the overlay content (canvas etc) should NOT close
            if (overlay.contains(e.target)) return;
        }
        // clicks inside the card should not close
        if (activePreview.card.contains(e.target)) return;
        // outside click: fully stop preview and remove tint/overlay in one action
        stopActivePreview(false);
    }, true);

    // Extra safety: if an overlay was created by another module (ThreeOverlay)
    // and activePreview isn't set, clicking the backdrop or outside the overlay
    // content should still remove the overlay and tint in one click.
    document.addEventListener('click', function(e){
        try {
            var overlayEl = e.target && e.target.closest ? e.target.closest('.shader-overlay') : null;
            if (!overlayEl) return;
            // consider clicks inside these content elements as "inside" the overlay
            var inCanvas = overlayEl.querySelector('.shader-overlay-canvas') && overlayEl.querySelector('.shader-overlay-canvas').contains(e.target);
            var inThree = overlayEl.querySelector('.threejs-mount') && overlayEl.querySelector('.threejs-mount').contains(e.target);
            var inTitle = e.target.closest && e.target.closest('.shader-overlay-title');
            var inClose = e.target.closest && e.target.closest('.shader-overlay-close');
            if (inCanvas || inThree || inTitle || inClose) return; // clicking content should not auto-close here
            // otherwise, remove all overlays and stop previews
            try { var overlays = document.querySelectorAll('.shader-overlay'); if (overlays && overlays.length) overlays.forEach(function(o){ try { if (o._threeCleanup) o._threeCleanup(); else if (o.parentNode) o.parentNode.removeChild(o); } catch(e){} }); } catch(e){}
            stopActivePreview(false);
            e.stopPropagation(); e.preventDefault();
        } catch (e) {}
    }, false);

    function safeText(t){ return (t||'Untitled').replace(/</g,'&lt;'); }

    function fetchShaders(){
        // Prefer the hosted JSON; if fetch fails (or file://) fall back to an embedded JS object
        return fetch('shadertoys/shaders_public.json').then(function(r){ return r.json(); }).catch(function(err){
            // If a full fallback JSON was embedded as JS, use it (window.SHADERS_PUBLIC)
            if (window && window.SHADERS_PUBLIC && window.SHADERS_PUBLIC.shaders) return window.SHADERS_PUBLIC;
            try {
                var fallback = window.SHADERS_FALLBACK || [];
                if (fallback && fallback.length) {
                    return { shaders: fallback.map(function(f){ return { info: { name: f.title, id: f.id }, url: 'https://www.shadertoy.com/view/' + f.id }; }) };
                }
            } catch (e) {}
            return { shaders: [] };
        });
    }

    function requiresExternalResources(src)
    {
        if (!src) return false;
        // treat mouse/keyboard/touch interactive shaders and any channel/buffer/audio usage as external
        return /iChannel|sampler2D|samplerCube|texture2D|iChannel0|iChannel1|iChannel2|iChannel3|buffer|sound|audio|iAudio|iMouse|mouse|touch|keyboard|keyCode/i.test(src);
    }

    function pickShaders(rawList)
    {
        var list = rawList || [];
        // If the file has a top-level `shaders` array, use it
        if (list && list.shaders && Array.isArray(list.shaders)) list = list.shaders;

        var out = [];
        list.forEach(function(entry){
            var code = '';
            if (entry && entry.renderpass && Array.isArray(entry.renderpass)) {
                entry.renderpass.forEach(function(rp){ if (rp && rp.code) code += rp.code + '\n'; });
            }
            if (!code) code = (entry.shader || entry.code || entry.src || '').toString();

            var hasInputs = false;
            if (entry && entry.renderpass && Array.isArray(entry.renderpass)) {
                entry.renderpass.forEach(function(rp){ if (rp && rp.inputs && rp.inputs.length) hasInputs = true; });
            }

            var item = {
                title: (entry && entry.info && entry.info.name) || entry.title || entry.name || entry._key || null,
                id: (entry && entry.info && entry.info.id) || entry.id || null,
                url: (entry && entry.info && entry.info.id) ? ('https://www.shadertoy.com/view/' + entry.info.id) : (entry.url || entry.view || null),
                code: code,
                raw: entry,
                isExternal: hasInputs || requiresExternalResources(code)
            };
            out.push(item);
        });

        // Preserve original order but cap the total shown
        return out.slice(0, MAX);
    }

    function shadertoyUrlFor(item)
    {
        if (!item) return null;
        if (item.shadertoy) return item.shadertoy;
        if (item.url) return item.url;
        if (item.view) return item.view;
        if (item.id) return 'https://www.shadertoy.com/view/' + item.id;
        return null;
    }

    function makeCard(item, idx)
    {
        var isExternal = !!item.isExternal;
        var card = document.createElement('div'); card.className = 'shader-card';
        var title = document.createElement('div'); title.className = 'shader-title'; title.innerHTML = safeText(item.title || item.name || ('Shader ' + (idx+1)));
        var thumb = document.createElement('div'); thumb.className = 'shader-thumb';
        var play = document.createElement('button'); play.className='shader-play';

        var shadertoyUrl = shadertoyUrlFor(item) || (item && item.url) || null;
        if (offlineMode) {
            // Render as a simple link card when offline/file:// — makes iteration easier
            var linkWrap = document.createElement('a');
            linkWrap.href = shadertoyUrl || '#';
            linkWrap.target = '_blank';
            linkWrap.rel = 'noopener';
            linkWrap.className = 'shader-link';
            thumb.appendChild(play);
            play.textContent = '↗'; play.disabled = !shadertoyUrl;
            linkWrap.appendChild(thumb);
            linkWrap.appendChild(title);
            card.appendChild(linkWrap);
            return card;
        }

        // inline/simple shader preview (deferred compile)
        // keep title visually at the bottom (thumb above, title below)
        play.textContent = '▶'; thumb.appendChild(play); card.appendChild(thumb); card.appendChild(title);

        // If this shader requires external resources, make the entire card a link to Shadertoy
        if (isExternal && shadertoyUrl) {
            var wrap = document.createElement('a');
            wrap.href = shadertoyUrl; wrap.target = '_blank'; wrap.rel = 'noopener'; wrap.className = 'shader-link';
            // remove play button behavior for external items
            thumb.removeChild(play);
            // show a small external indicator in the thumb
            var ext = document.createElement('div'); ext.className = 'shader-external'; ext.textContent = '↗'; ext.style.position = 'absolute'; ext.style.right = '8px'; ext.style.top = '8px'; ext.style.color = '#ddd'; thumb.appendChild(ext);
            wrap.appendChild(thumb); wrap.appendChild(title);
            card.appendChild(wrap);
            return card;
        }

        var previewGL = null;
        var overlayPreview = null; // separate overlay preview instance

        function compileAndRun(canvas, src)
        {
            // Multipass support: if the original raw entry contains a renderpass array,
            // prefer a multipass implementation using WebGL2 where available and fall
            // back to a single-pass compile otherwise.
            var raw = item && item.raw;
            if (raw && raw.renderpass && Array.isArray(raw.renderpass) && raw.renderpass.length > 0) {
                return compileAndRunMultipass(canvas, raw);
            }

            // Single-pass fallback (existing behavior)
            var gl = canvas.getContext('webgl',{antialias:false});
            if (!gl) { canvas.replaceWith(document.createTextNode('WebGL unavailable')); return null; }
            var vert = '\nattribute vec2 aPos;\nvoid main(){ gl_Position = vec4(aPos,0.,1.); }\n';
            var hasMainImage = /mainImage\s*\(/.test(src);
            var frag = '\nprecision mediump float;\nuniform vec2 iResolution;\nuniform float iTime;\n' + src + '\n' + (hasMainImage ? '\nvoid main(){ vec2 fragCoord = gl_FragCoord.xy; vec4 col = vec4(0.0); mainImage(col, fragCoord); gl_FragColor = col; }\n' : '');

            function compile(type, srcText){ var s = gl.createShader(type); gl.shaderSource(s, srcText); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'compile error'); return s; }

            try {
                var vs = compile(gl.VERTEX_SHADER, vert);
                var fs = compile(gl.FRAGMENT_SHADER, frag);
                var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.bindAttribLocation(prog,0,'aPos'); gl.linkProgram(prog);
                if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
                gl.useProgram(prog);
                var aPos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, aPos);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
                gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
                var uRes = gl.getUniformLocation(prog,'iResolution'); var uTime = gl.getUniformLocation(prog,'iTime');

                function resize(){ var dpr = Math.max(1, window.devicePixelRatio || 1); var w = Math.max(1, Math.floor(canvas.clientWidth * dpr)); var h = Math.max(1, Math.floor(canvas.clientHeight * dpr)); if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; gl.viewport(0,0,w,h); } if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height); }

                var start = performance.now(); var rafId = null; var paused = false;
                function frame(){ if (paused) return; resize(); var t = (performance.now() - start) / 1000; if (uTime) gl.uniform1f(uTime, t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); rafId = requestAnimationFrame(frame); }
                frame();
                return { stop: function(){ paused = true; if (rafId) cancelAnimationFrame(rafId); }, resume: function(){ if (paused){ paused = false; start = performance.now(); requestAnimationFrame(frame); } }, gl: gl };
            } catch (err) { var pre = document.createElement('pre'); pre.className = 'shader-error'; pre.textContent = 'Compile error:\n' + (err.message || err); canvas.parentNode.replaceChild(pre, canvas); return null; }
        }

        // Multipass implementation (simplified): create per-pass programs and FBOs,
        // bind previous-pass textures as iChannel0..3, and run passes in order.
        function compileAndRunMultipass(canvas, raw)
        {
            // Prefer WebGL2 for reliable float render targets
            var gl = canvas.getContext('webgl2', { antialias: false }) || canvas.getContext('webgl', { antialias: false }) || canvas.getContext('experimental-webgl');
            if (!gl) { canvas.replaceWith(document.createTextNode('WebGL unavailable')); return null; }

            var isWebGL2 = !!canvas.getContext('webgl2');
            var extColorFloat = null;
            if (!isWebGL2) {
                extColorFloat = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('WEBGL_color_buffer_float');
                if (!extColorFloat) {
                    // graceful degradation: fall back to single-pass
                    console.warn('Floating point FBO not available; falling back to single-pass');
                    return compileAndRun(canvas, raw.renderpass.map(function(r){ return r.code || ''; }).join('\n'));
                }
            }

            // helpers
            function makeProgram(vsSrc, fsSrc) {
                function compile(type, srcText){ var s = gl.createShader(type); gl.shaderSource(s, srcText); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'compile error'); return s; }
                var vs = compile(gl.VERTEX_SHADER, vsSrc);
                var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
                var p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.bindAttribLocation(p,0,'aPos'); gl.linkProgram(p);
                if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link failed');
                return p;
            }

            var quadBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);

            // Build pass objects
            var passes = raw.renderpass.map(function(r, idx){
                var code = r && r.code ? r.code : (r.shader || '');
                var hasMainImage = /mainImage\s*\(/.test(code);
                var frag = '\nprecision highp float;\nuniform vec2 iResolution;\nuniform float iTime;\n' + code + '\n' + (hasMainImage ? '\nvoid main(){ vec2 fragCoord = gl_FragCoord.xy; vec4 col = vec4(0.0); mainImage(col, fragCoord); gl_FragColor = col; }\n' : '');
                var vert = '\nattribute vec2 aPos;\nvoid main(){ gl_Position = vec4(aPos,0.,1.); }\n';
                var program = null;
                try { program = makeProgram(vert, frag); } catch (e) { console.warn('Pass compile failed', e); }
                // allocate two textures for ping-pong to be safe
                var texA = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texA); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                var texB = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texB); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                var fbo = gl.createFramebuffer();
                // handle inputs (iChannelN): allow external image URLs or pass references by index
                var inputs = [];
                if (r && Array.isArray(r.inputs)) {
                    r.inputs.forEach(function(inp, ii){
                        var entry = { type: 'empty', tex: null, src: inp };
                        // if numeric, treat as pass index
                        if (typeof inp === 'number') { entry.type = 'pass'; entry.passIndex = inp; }
                        else if (inp && typeof inp === 'object') {
                            if (typeof inp.src === 'number') { entry.type = 'pass'; entry.passIndex = inp.src; }
                            else if (typeof inp.src === 'string' && (inp.src.indexOf('http') === 0 || inp.src.indexOf('/') >= 0)) { entry.type = 'image'; entry.url = inp.src; }
                        } else if (typeof inp === 'string' && (inp.indexOf('http') === 0 || inp.indexOf('/') >= 0)) { entry.type = 'image'; entry.url = inp; }
                        inputs.push(entry);
                    });
                }
                // create placeholder textures for image inputs; they'll be updated on load
                inputs.forEach(function(entry){ if (entry.type === 'image') { var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // 1x1 pixel placeholder
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1,1,0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128,128,128,255])); entry.tex = tex; // load image async
                    var img = new Image(); img.crossOrigin = 'anonymous'; img.onload = function(){ gl.bindTexture(gl.TEXTURE_2D, tex); try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch(e) { try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch(e2) { console.warn('texImage2D failed', e2); } } }; img.onerror = function(){ console.warn('Image load failed for', entry.url); }; if (entry.url) img.src = entry.url; } });
                return { program: program, texA: texA, texB: texB, fbo: fbo, width: canvas.width, height: canvas.height, ping: 0, inputs: inputs };
            });

            // initialize textures with empty data
            function allocTex(tex, w, h) {
                gl.bindTexture(gl.TEXTURE_2D, tex);
                if (isWebGL2) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
                else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.FLOAT, null);
            }

            function resizeAll() {
                var dpr = Math.max(1, window.devicePixelRatio || 1);
                var w = Math.max(1, Math.floor(canvas.clientWidth * dpr)); var h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
                if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
                passes.forEach(function(p){ p.width = canvas.width; p.height = canvas.height; allocTex(p.texA, p.width, p.height); allocTex(p.texB, p.width, p.height); });
                gl.viewport(0,0,canvas.width, canvas.height);
            }

            // uniform/state locations cache
            passes.forEach(function(p){ if (p.program) { p.uRes = gl.getUniformLocation(p.program, 'iResolution'); p.uTime = gl.getUniformLocation(p.program, 'iTime'); } });

            var start = performance.now(); var raf = null; var stopped = false; var frameN = 0;
            function step() {
                if (stopped) return;
                resizeAll();
                var t = (performance.now() - start) / 1000;
                // run passes in order; bind previous pass outputs as iChannel0..3
                passes.forEach(function(p, idx){
                    if (!p.program) return;
                    // determine write texture (ping-pong)
                    var writeTex = (p.ping === 0) ? p.texA : p.texB;
                    var readTex = (p.ping === 0) ? p.texB : p.texA;
                    gl.bindFramebuffer(gl.FRAMEBUFFER, p.fbo);
                    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, writeTex, 0);
                    gl.viewport(0,0,p.width,p.height);
                    gl.useProgram(p.program);
                    // bind quad
                    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
                    // bind inputs to texture units iChannel0..3
                    for (var ci=0; ci<4; ++ci) {
                        var unit = gl.TEXTURE0 + ci;
                        gl.activeTexture(unit);
                        var loc = gl.getUniformLocation(p.program, 'iChannel' + ci);
                        var bound = false;
                        // explicit inputs take precedence
                        if (p.inputs && p.inputs[ci]) {
                            var inp = p.inputs[ci];
                            if (inp.type === 'image' && inp.tex) { gl.bindTexture(gl.TEXTURE_2D, inp.tex); bound = true; }
                            else if (inp.type === 'pass' && typeof inp.passIndex === 'number') {
                                var srcPass = passes[inp.passIndex];
                                if (srcPass) { var srcTex = (srcPass.ping === 0) ? srcPass.texA : srcPass.texB; gl.bindTexture(gl.TEXTURE_2D, srcTex); bound = true; }
                            }
                        }
                        // fallback heuristic: use previous passes
                        if (!bound) {
                            var srcPass = passes[idx - 1 - ci];
                            if (srcPass) { var srcTex = (srcPass.ping === 0) ? srcPass.texA : srcPass.texB; gl.bindTexture(gl.TEXTURE_2D, srcTex); bound = true; }
                        }
                        if (!bound) gl.bindTexture(gl.TEXTURE_2D, null);
                        if (loc) gl.uniform1i(loc, ci);
                    }
                    if (p.uRes) gl.uniform2f(p.uRes, p.width, p.height);
                    if (p.uTime) gl.uniform1f(p.uTime, t);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                    // swap ping
                    p.ping = 1 - p.ping;
                });
                // present last pass to screen
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0,0,canvas.width, canvas.height);
                var last = passes[passes.length-1];
                if (last && last.program) {
                    // render a simple textured quad using last.read texture
                    var texToShow = (last.ping === 0) ? last.texB : last.texA;
                    // use a simple blit shader if available; otherwise draw using the last pass program by binding texture as iChannel0
                    gl.useProgram(last.program);
                    var locC = gl.getUniformLocation(last.program, 'iChannel0'); if (locC) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texToShow); gl.uniform1i(locC, 0); }
                    if (last.uRes) gl.uniform2f(last.uRes, canvas.width, canvas.height);
                    var pos = quadBuffer; gl.bindBuffer(gl.ARRAY_BUFFER, pos); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                }
                frameN++; raf = requestAnimationFrame(step);
            }

            step();
            return { stop: function(){ stopped = true; if (raf) cancelAnimationFrame(raf); }, resume: function(){ if (stopped) { stopped = false; start = performance.now(); step(); } }, gl: gl };
        }

        function startPreview()
        {
            if (previewGL) return;
            // stop any other preview/overlay, preserving their last frame
            stopActivePreview(true);

            // if there is a static image from a previous run, remove it before creating canvas
            if (activePreview && activePreview.staticImg && activePreview.staticImg.parentNode) {
                activePreview.staticImg.parentNode.removeChild(activePreview.staticImg);
                activePreview.staticImg = null;
            }

            var c = document.createElement('canvas'); c.width = PRE_W; c.height = PRE_H; c.style.width = '100%'; c.style.height = PRE_H + 'px'; thumb.innerHTML = ''; thumb.appendChild(c);
            previewGL = compileAndRun(c, item.code || item.shader || item.src || '');
            if (!previewGL) return;
            var io = new IntersectionObserver(function(entries){ entries.forEach(function(en){ if (previewGL && previewGL.resume && previewGL.stop){ if (en.isIntersecting) previewGL.resume(); else previewGL.stop(); } }); }, { threshold: 0.1 });
            io.observe(c);
            // record active preview
            activePreview = { card: card, thumb: thumb, canvas: c, previewGLThumb: previewGL, io: io };
            // expose restart hooks so static-image play button can call back
            try { card._startPreview = startPreview; card._openOverlay = openOverlay; } catch (e) {}
        }

        function openOverlay()
        {
            // If a Three.js overlay handler is available, prefer it (supports textures/iChannel)
            if (window.ThreeOverlay && typeof window.ThreeOverlay.open === 'function') {
                var handled = false;
                try { handled = window.ThreeOverlay.open(item); } catch (e) { console.warn('ThreeOverlay failed', e); }
                if (handled) return;
            }

            var overlay = document.createElement('div'); overlay.className = 'shader-overlay';
            var close = document.createElement('button'); close.className = 'shader-overlay-close'; close.textContent = '✕';
            var titleEl = document.createElement('div'); titleEl.className = 'shader-overlay-title'; titleEl.innerHTML = safeText(item.title || item.name || 'Shader');
            var canvas = document.createElement('canvas'); canvas.className = 'shader-overlay-canvas';
            overlay.appendChild(close); overlay.appendChild(titleEl); overlay.appendChild(canvas); document.body.appendChild(overlay);
                // mark overlay on activePreview so it can be removed when stopping
                try { activePreview = activePreview || {}; activePreview.overlayEl = overlay; } catch(e){}
            canvas.width = OVERLAY_W; canvas.height = OVERLAY_H; canvas.style.width = Math.min(window.innerWidth * 0.95, OVERLAY_W) + 'px'; canvas.style.height = (parseFloat(canvas.style.width) * OVERLAY_H / OVERLAY_W) + 'px';
            var ov = compileAndRun(canvas, item.code || item.shader || item.src || '');
            // store overlay-specific preview separately
            try { if (activePreview) activePreview.overlayPreview = ov; } catch(e){}
            var onK = function onK(e){ if (e.key === 'Escape'){ closeOverlay(); document.removeEventListener('keydown', onK); }};
            function closeOverlay(){ try { if (ov && ov.stop) ov.stop(); } catch(e){} try { document.removeEventListener('keydown', onK); } catch(e){} if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); }
            close.addEventListener('click', function(ev){ ev.stopPropagation(); closeOverlay(); });
            // close on single click outside the canvas (backdrop or anywhere not inside the canvas)
            overlay.addEventListener('click', function(e){ var inner = canvas; if (e.target === overlay || (inner && !inner.contains(e.target))) { closeOverlay(); } });
            document.addEventListener('keydown', onK);
        }

        play.addEventListener('click', function(ev){ ev.stopPropagation(); if (!previewGL) startPreview(); openOverlay(); });

        // Make clicking anywhere on the card start the preview / open overlay (ignore clicks on buttons)
        card.addEventListener('click', function(ev){ if (ev.target.closest && ev.target.closest('button, a')) return; if (!previewGL) startPreview(); openOverlay(); });

        return card;
    }

    function renderGrid(list)
    {
        var root = document.getElementById('shader-grid'); if (!root) return; root.innerHTML = ''; var grid = document.createElement('div'); grid.className = 'shader-grid-inner'; list.forEach(function(it,i){ grid.appendChild(makeCard(it,i)); }); root.appendChild(grid);
    }

    fetchShaders().then(function(all){ var chosen = pickShaders(all || []); renderGrid(chosen); });
})();
