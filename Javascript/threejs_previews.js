/* threejs_previews.js
   Optional Three.js-based overlay renderer for shader previews.
   Exposes window.ThreeOverlay.open(item) -> returns true if it handled the overlay.
   It attempts to load up to 4 iChannel textures from `shadertoys` paths when present.
*/
(function(){
    if (!window.THREE) return; // three.js not loaded

    function tryLoadTexturesFromRenderpass(entry, cb) {
        var textures = [];
        var pending = 0;
        var done = false;

        function finish() {
            if (done) return; done = true; cb(textures);
        }

        try {
            var passes = entry && entry.raw && entry.raw.renderpass ? entry.raw.renderpass : null;
            if (!passes) return finish();
            // collect inputs declared in renderpass[0] (simple heuristic)
            var inputs = passes[0] && passes[0].inputs ? passes[0].inputs : [];
            if (!inputs.length) return finish();

            inputs.slice(0,4).forEach(function(inp, idx){
                if (!inp || !inp.filepath || !inp.published) return;
                pending++;
                var url = 'shadertoys' + inp.filepath; // local path attempt
                new THREE.TextureLoader().load(url, function(tex){ textures[idx] = tex; pending--; if (pending===0) finish(); }, function(){ pending--; if (pending===0) finish(); });
            });
            if (pending===0) finish();
        } catch (e) { finish(); }
    }

    function buildMaterialFromCode(code, textures) {
        var hasMain = /mainImage\s*\(/.test(code);
        var frag = 'precision mediump float;\nuniform vec2 iResolution;\nuniform float iTime;\nuniform vec4 iMouse;\n';
        for (var i=0;i<4;i++) frag += 'uniform sampler2D iChannel' + i + ';\n';
        frag += '\n' + code + '\n';
        if (hasMain) {
            frag += '\nvoid main(){ vec2 fragCoord = gl_FragCoord.xy; vec4 col = vec4(0.0); mainImage(col, fragCoord); gl_FragColor = col; }\n';
        }

        var uniforms = { iResolution: { value: new THREE.Vector2(800,600) }, iTime: { value: 0 }, iMouse: { value: new THREE.Vector4(0,0,0,0) } };
        for (var j=0;j<4;j++) uniforms['iChannel'+j] = { value: textures[j] || new THREE.Texture() };

        return new THREE.ShaderMaterial({ fragmentShader: frag, vertexShader: 'attribute vec2 position; void main(){ gl_Position = vec4(position,0.0,1.0); }', uniforms: uniforms });
    }

    window.ThreeOverlay = {
        open: function(item){
            try {
                // only handle items with code
                if (!item || !item.code) return false;

                // If the shader requires external resources but we cannot find textures, bail
                var requiresExt = /iChannel|sampler2D|buffer|iChannel0|iChannel1/i.test(item.code) || (item.raw && item.raw.renderpass && item.raw.renderpass.some(function(r){ return r.inputs && r.inputs.length; }));

                // Try to load textures if inputs exist; otherwise proceed.
                tryLoadTexturesFromRenderpass(item, function(textures){
                    // If resources were required but none loaded, do not attempt overlay (let fallback open Shadertoy)
                    var anyTex = textures && textures.some(function(t){ return !!t; });
                    if (requiresExt && !anyTex) {
                        // indicate we didn't handle it
                        return;
                    }

                    var overlay = document.createElement('div'); overlay.className = 'shader-overlay';
                    var close = document.createElement('button'); close.className = 'shader-overlay-close'; close.textContent = '✕';
                    var titleEl = document.createElement('div'); titleEl.className = 'shader-overlay-title'; titleEl.textContent = item.title || (item.raw && item.raw.info && item.raw.info.name) || 'Shader';
                    var mount = document.createElement('div'); mount.className = 'threejs-mount';
                    overlay.appendChild(close); overlay.appendChild(titleEl); overlay.appendChild(mount); document.body.appendChild(overlay);

                    var width = Math.min(window.innerWidth * 0.9, 900);
                    var height = Math.round(width * 506/900);

                    var renderer = new THREE.WebGLRenderer({ antialias: true });
                    renderer.setSize(width, height);
                    mount.appendChild(renderer.domElement);

                    var scene = new THREE.Scene();
                    var camera = new THREE.OrthographicCamera(-1,1,1,-1,0,10);
                    camera.position.z = 1;
                    var geom = new THREE.PlaneGeometry(2,2);

                    var mat = buildMaterialFromCode(item.code, textures || []);
                    mat.uniforms.iResolution.value.set(width, height);

                    var mouse = { x: 0, y: 0, clickX: 0, clickY: 0, down: false };
                    function toShaderMouse(ev) {
                        var rect = renderer.domElement.getBoundingClientRect();
                        if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
                        var localX = ev.clientX - rect.left;
                        var localY = ev.clientY - rect.top;
                        var x = Math.max(0, Math.min(rect.width, localX)) * (renderer.domElement.width / rect.width);
                        var yTop = Math.max(0, Math.min(rect.height, localY)) * (renderer.domElement.height / rect.height);
                        var y = renderer.domElement.height - yTop;
                        return { x: x, y: y };
                    }

                    function onPointerDown(ev) {
                        var p = toShaderMouse(ev);
                        mouse.down = true;
                        mouse.x = p.x; mouse.y = p.y;
                        mouse.clickX = p.x; mouse.clickY = p.y;
                    }

                    function onPointerMove(ev) {
                        var p = toShaderMouse(ev);
                        mouse.x = p.x; mouse.y = p.y;
                    }

                    function onPointerUp(ev) {
                        var p = toShaderMouse(ev);
                        mouse.x = p.x; mouse.y = p.y;
                        mouse.down = false;
                    }

                    renderer.domElement.addEventListener('pointerdown', onPointerDown);
                    renderer.domElement.addEventListener('pointermove', onPointerMove);
                    window.addEventListener('pointerup', onPointerUp);

                    var mesh = new THREE.Mesh(geom, mat); scene.add(mesh);

                    var start = performance.now(); var raf = null;
                    function loop(){ mat.uniforms.iTime.value = (performance.now() - start)/1000; mat.uniforms.iMouse.value.set(mouse.x, mouse.y, mouse.down ? mouse.clickX : -Math.abs(mouse.clickX), mouse.down ? mouse.clickY : -Math.abs(mouse.clickY)); renderer.render(scene, camera); raf = requestAnimationFrame(loop); }
                    loop();

                    var onK = function onK(e){ if (e.key === 'Escape'){ if (overlay && overlay._threeCleanup) overlay._threeCleanup(); } };
                    function internalCleanup(){ try { if (raf) cancelAnimationFrame(raf); } catch(e){}
                        try { renderer.dispose(); } catch(e){}
                        try { renderer.domElement.removeEventListener('pointerdown', onPointerDown); } catch(e){}
                        try { renderer.domElement.removeEventListener('pointermove', onPointerMove); } catch(e){}
                        try { window.removeEventListener('pointerup', onPointerUp); } catch(e){}
                        try { document.removeEventListener('keydown', onK); } catch(e){}
                    }
                    // attach a cleanup function to the overlay element so external code can force-close it
                    overlay._threeCleanup = function(){ internalCleanup(); if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); };

                    close.addEventListener('click', function(ev){ ev.stopPropagation(); if (overlay && overlay._threeCleanup) overlay._threeCleanup(); });
                    // Close when clicking on the backdrop or anywhere outside the mount content (single click)
                    overlay.addEventListener('click', function(e){ if (e.target === overlay || !mount.contains(e.target)) { if (overlay && overlay._threeCleanup) overlay._threeCleanup(); } });
                    document.addEventListener('keydown', onK);
                });

                // We do async handling (texture loads) so don't claim synchronous handling here.
                // Return false so callers fall back immediately; the Three.js overlay may still open later.
                return false;
            } catch (e) { console.error('ThreeOverlay error', e); return false; }
        }
    };
})();
