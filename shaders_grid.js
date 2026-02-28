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

        try { if (activePreview.previewGL && activePreview.previewGL.stop) activePreview.previewGL.stop(); } catch(e){}
        try { if (activePreview.io && activePreview.io.disconnect) activePreview.io.disconnect(); } catch(e){}
        try { if (activePreview.overlayEl && activePreview.overlayEl.parentNode) activePreview.overlayEl.parentNode.removeChild(activePreview.overlayEl); } catch(e){}
        // do not remove staticImg; leave it visible
        // preserve card and thumb so the static image can restart the preview
        var keepImg = activePreview.staticImg || null;
        var keepCard = activePreview.card || null;
        var keepThumb = activePreview.thumb || null;
        activePreview = null;
        if (keepImg) activePreview = { card: keepCard, thumb: keepThumb, staticImg: keepImg };
    }

    // stop preview when clicking outside the active card
    document.addEventListener('click', function(e){
        if (!activePreview || !activePreview.card) return;
        if (activePreview.card.contains(e.target)) return; // click inside active card -> ignore
        stopActivePreview(true);
    }, true);

    function safeText(t){ return (t||'Untitled').replace(/</g,'&lt;'); }

    function fetchShaders(){
        // shaders_public.json lives in the `shadertoys/` subfolder
        // If running from `file:` or fetch fails, fall back to a small embedded index (shadertoys/shaders_index.js)
        return fetch('shadertoys/shaders_public.json').then(function(r){ return r.json(); }).catch(function(err){
            try {
                var fallback = window.SHADERS_FALLBACK || [];
                if (fallback && fallback.length) {
                    // Normalize to same shape: top-level object with `shaders` array
                    return { shaders: fallback.map(function(f){ return { info: { name: f.title, id: f.id }, url: 'https://www.shadertoy.com/view/' + f.id }; }) };
                }
            } catch (e) {}
            return [];
        });
    }

    function requiresExternalResources(src)
    {
        if (!src) return false;
        return /iChannel|sampler2D|samplerCube|texture2D|iChannel0|iChannel1|iChannel2|iChannel3|buffer|sound|audio|iAudio/i.test(src);
    }

    function pickShaders(rawList)
    {
        var list = rawList || [];
        // If the file has a top-level `shaders` array, use it
        if (list && list.shaders && Array.isArray(list.shaders)) list = list.shaders;

        var simple = [];
        var external = [];
        list.forEach(function(entry){
            // normalize: entry may be an object with `info` and `renderpass`
            var code = '';
            if (entry && entry.renderpass && Array.isArray(entry.renderpass)) {
                entry.renderpass.forEach(function(rp){ if (rp && rp.code) code += rp.code + '\n'; });
            }
            // fallback to common fields
            if (!code) code = (entry.shader || entry.code || entry.src || '').toString();

            var item = {
                title: (entry && entry.info && entry.info.name) || entry.title || entry.name || entry._key || null,
                id: (entry && entry.info && entry.info.id) || entry.id || null,
                url: (entry && entry.info && entry.info.id) ? ('https://www.shadertoy.com/view/' + entry.info.id) : (entry.url || entry.view || null),
                code: code,
                raw: entry
            };

            // also treat entries with renderpass inputs as external
            var hasInputs = false;
            if (entry && entry.renderpass && Array.isArray(entry.renderpass)) {
                entry.renderpass.forEach(function(rp){ if (rp && rp.inputs && rp.inputs.length) hasInputs = true; });
            }

            if (hasInputs || requiresExternalResources(code)) external.push(item); else simple.push(item);
        });

        return simple.slice(0, MAX).concat(external.slice(0, 6));
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
        var isExternal = requiresExternalResources((item.code || '').toString()) || !!(item.raw && (item.raw.renderpass && item.raw.renderpass.some(function(r){ return r.inputs && r.inputs.length; })));
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
        play.textContent = '▶'; thumb.appendChild(play); card.appendChild(title); card.appendChild(thumb);

        var previewGL = null;

        function compileAndRun(canvas, src)
        {
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
            activePreview = { card: card, thumb: thumb, canvas: c, previewGL: previewGL, io: io };
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
            var canvas = document.createElement('canvas'); canvas.className = 'shader-overlay-canvas';
            overlay.appendChild(close); overlay.appendChild(canvas); document.body.appendChild(overlay);
                // mark overlay on activePreview so it can be removed when stopping
                try { activePreview = activePreview || {}; activePreview.overlayEl = overlay; } catch(e){}
            canvas.width = OVERLAY_W; canvas.height = OVERLAY_H; canvas.style.width = Math.min(window.innerWidth * 0.95, OVERLAY_W) + 'px'; canvas.style.height = (parseFloat(canvas.style.width) * OVERLAY_H / OVERLAY_W) + 'px';
            var ov = compileAndRun(canvas, item.code || item.shader || item.src || '');
                try { if (activePreview) activePreview.previewGL = ov; } catch(e){}
            function closeOverlay(){ try { if (ov && ov.stop) ov.stop(); } catch(e){} overlay.remove(); }
            close.addEventListener('click', closeOverlay); overlay.addEventListener('click', function(e){ if (e.target === overlay) closeOverlay(); }); document.addEventListener('keydown', function onK(e){ if (e.key === 'Escape'){ closeOverlay(); document.removeEventListener('keydown', onK); }});
        }

        play.addEventListener('click', function(ev){ ev.stopPropagation(); if (!previewGL) startPreview(); openOverlay(); });

        return card;
    }

    function renderGrid(list)
    {
        var root = document.getElementById('shader-grid'); if (!root) return; root.innerHTML = ''; var grid = document.createElement('div'); grid.className = 'shader-grid-inner'; list.forEach(function(it,i){ grid.appendChild(makeCard(it,i)); }); root.appendChild(grid);
    }

    fetchShaders().then(function(all){ var chosen = pickShaders(all || []); renderGrid(chosen); });
})();
