/* shaders_preview.js
   Lightweight Shadertoy-style previewer for simple fragment shaders
   - Loads `shaders_public.json` (best-effort parser)
   - Renders small WebGL previews for shaders that don't reference external channels
   - Pauses previews when off-screen via IntersectionObserver
   - Shows compile/link errors as plain text in the card

   Usage:
   - Include a container with id `shader-previews` on `projects_shadertoys.html` or let the script
     append one to the document body.
   - Include this script at the end of the page: <script src="shaders_preview.js"></script>
*/

(function()
{
    var MAX_PREVIEWS = 6;
    var PREVIEW_W = 320;
    var PREVIEW_H = 180;

    function isShaderText(s)
    {
        return typeof s === 'string' && (s.indexOf('mainImage') !== -1 || s.indexOf('gl_FragColor') !== -1 || s.indexOf('void main') !== -1);
    }

    function buildFragment(src)
    {
        var prefix = 'precision mediump float;\n' +
                     'uniform vec2 iResolution;\n' +
                     'uniform float iTime;\n';

        if (src.indexOf('mainImage') !== -1)
        {
            return prefix + src + '\nvoid main()\n{\n    vec2 uv = gl_FragCoord.xy / iResolution;\n    vec4 col = vec4(0.0);\n    mainImage(col, uv);\n    gl_FragColor = col;\n}\n';
        }

        // If shader already writes to gl_FragColor or defines main, just prepend uniforms
        if (src.indexOf('gl_FragColor') !== -1 || src.indexOf('void main') !== -1)
        {
            return prefix + src;
        }

        // Fallback: wrap a minimal shader to show something
        return prefix + 'void main()\n{\n    vec2 uv = gl_FragCoord.xy / iResolution;\n    gl_FragColor = vec4(uv, 0.5 + 0.5 * sin(iTime), 1.0);\n}\n';
    }

    function createShader(gl, type, src)
    {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        {
            var err = gl.getShaderInfoLog(s);
            gl.deleteShader(s);
            throw new Error('Shader compile error: ' + err);
        }
        return s;
    }

    function createProgram(gl, vsSrc, fsSrc)
    {
        var vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
        var fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
        var p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        {
            var err = gl.getProgramInfoLog(p);
            gl.deleteProgram(p);
            throw new Error('Program link error: ' + err);
        }
        return p;
    }

    function initPreview(canvas, fragSource, titleEl)
    {
        var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl)
        {
            titleEl && (titleEl.textContent += ' (WebGL unavailable)');
            return null;
        }

        var vsSrc = 'attribute vec2 aPos;\nvoid main()\n{\n    gl_Position = vec4(aPos, 0.0, 1.0);\n}\n';
        var fsSrc = buildFragment(fragSource);

        var program;
        try
        {
            program = createProgram(gl, vsSrc, fsSrc);
        }
        catch (e)
        {
            // show compile/link error text in canvas's parent
            var pre = document.createElement('pre');
            pre.className = 'shader-error';
            pre.textContent = String(e);
            canvas.parentNode.appendChild(pre);
            return null;
        }

        var posLoc = gl.getAttribLocation(program, 'aPos');
        var iResolution = gl.getUniformLocation(program, 'iResolution');
        var iTime = gl.getUniformLocation(program, 'iTime');

        var quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

        var start = performance.now();
        var rafId = null;

        function render()
        {
            var now = (performance.now() - start) / 1000.0;
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0,0,0,1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, quad);
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
            if (iResolution) gl.uniform2f(iResolution, canvas.width, canvas.height);
            if (iTime) gl.uniform1f(iTime, now);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            rafId = requestAnimationFrame(render);
        }

        // IntersectionObserver to pause when offscreen
        var observer = new IntersectionObserver(function(entries)
        {
            entries.forEach(function(ent)
            {
                if (ent.isIntersecting)
                {
                    if (!rafId) render();
                }
                else
                {
                    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
                }
            });
        }, { root: null, threshold: 0.05 });

        observer.observe(canvas);

        // start if visible
        // small delay to allow layout
        setTimeout(function(){
            var rect = canvas.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0)
            {
                render();
            }
        }, 50);

        return { stop: function() { if (rafId) cancelAnimationFrame(rafId); observer.disconnect(); } };
    }

    // Create container and load JSON
    function createContainer()
    {
        var c = document.getElementById('shader-previews');
        if (c) return c;
        var wrapper = document.createElement('div');
        wrapper.id = 'shader-previews';
        wrapper.style.display = 'grid';
        wrapper.style.gridTemplateColumns = 'repeat(auto-fit, minmax(340px, 1fr))';
        wrapper.style.gap = '12px';
        wrapper.style.margin = '12px';
        document.body.appendChild(wrapper);
        return wrapper;
    }

    fetch('shaders_public.json').then(function(resp)
    {
        return resp.json();
    }).then(function(json)
    {
        var arr = [];
        if (Array.isArray(json)) arr = json;
        else if (typeof json === 'object')
        {
            // if object map, convert to array preserving keys
            arr = Object.keys(json).map(function(k){ var v = json[k]; if (!v) v = {}; v._key = k; return v; });
        }

        var found = [];
        for (var i = 0; i < arr.length && found.length < MAX_PREVIEWS; ++i)
        {
            var item = arr[i];
            var code = null;
            if (typeof item === 'string') code = isShaderText(item) ? item : null;
            else if (typeof item === 'object')
            {
                ['frag','fragment','code','glsl','shader','source'].some(function(k){ if (item[k] && isShaderText(item[k])) { code = item[k]; return true; } return false; });
                if (!code)
                {
                    for (var p in item)
                    {
                        if (item.hasOwnProperty(p) && isShaderText(item[p])) { code = item[p]; break; }
                    }
                }
            }

            if (code)
            {
                found.push({ name: item.name || item.title || item._key || ('shader_' + i), code: code });
            }
        }

        if (!found.length)
        {
            console.warn('No suitable shaders found in shaders_public.json');
            return;
        }

        var container = createContainer();
        found.forEach(function(s)
        {
            var card = document.createElement('div');
            card.className = 'shader-card';
            card.style.background = 'rgba(0,0,0,0.6)';
            card.style.padding = '8px';
            card.style.borderRadius = '6px';
            card.style.color = '#ddd';

            var title = document.createElement('div');
            title.className = 'shader-title';
            title.textContent = s.name;
            title.style.marginBottom = '6px';
            title.style.fontSize = '14px';

            var canvas = document.createElement('canvas');
            canvas.width = PREVIEW_W;
            canvas.height = PREVIEW_H;
            canvas.style.width = PREVIEW_W + 'px';
            canvas.style.height = PREVIEW_H + 'px';
            canvas.style.display = 'block';
            canvas.style.borderRadius = '4px';
            canvas.style.boxShadow = '0 1px 4px rgba(0,0,0,0.6)';

            card.appendChild(title);
            card.appendChild(canvas);
            container.appendChild(card);

            initPreview(canvas, s.code, title);
        });
    }).catch(function(err)
    {
        console.error('Failed to load shaders_public.json', err);
    });

})();
