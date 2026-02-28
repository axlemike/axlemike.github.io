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

    function safeText(t){ return (t||'Untitled').replace(/</g,'&lt;'); }

    function fetchShaders(){
        // shaders_public.json lives in the `shadertoys/` subfolder
        return fetch('shadertoys/shaders_public.json').then(function(r){ return r.json(); }).catch(function(){ return []; });
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

        if (isExternal)
        {
            play.textContent = '↗';
            var url = item.url || shadertoyUrlFor(item.raw || item);
            if (!url) play.disabled = true;
            thumb.appendChild(play);
            card.appendChild(title); card.appendChild(thumb);

            play.addEventListener('click', function(ev){ ev.stopPropagation(); if (!url) return; window.open(url, '_blank', 'noopener'); });
            var hint = document.createElement('div'); hint.className = 'shader-hint'; hint.textContent = url ? 'Opens on Shadertoy (external resources)' : 'External resources — no preview';
            card.appendChild(hint);
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
            var c = document.createElement('canvas'); c.width = PRE_W; c.height = PRE_H; c.style.width = PRE_W + 'px'; c.style.height = PRE_H + 'px'; thumb.innerHTML = ''; thumb.appendChild(c);
            previewGL = compileAndRun(c, item.code || item.shader || item.src || '');
            if (!previewGL) return;
            var io = new IntersectionObserver(function(entries){ entries.forEach(function(en){ if (previewGL && previewGL.resume && previewGL.stop){ if (en.isIntersecting) previewGL.resume(); else previewGL.stop(); } }); }, { threshold: 0.1 });
            io.observe(c);
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
            canvas.width = OVERLAY_W; canvas.height = OVERLAY_H; canvas.style.width = Math.min(window.innerWidth * 0.95, OVERLAY_W) + 'px'; canvas.style.height = (parseFloat(canvas.style.width) * OVERLAY_H / OVERLAY_W) + 'px';
            var ov = compileAndRun(canvas, item.code || item.shader || item.src || '');
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
