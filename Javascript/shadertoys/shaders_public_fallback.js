/* Unified fallback loader for shadertoys/shaders_public.json
   - Synchronously exposes `window.SHADERS_PUBLIC` with the canonical payload
     so offline/file:// pages see the full list immediately.
   - When served, attempts to fetch a hosted copy at `shadertoys/shaders_public.json`
     (relative path) and overwrites the embedded payload if successful.
*/
(function(){
  // Embedded canonical minimal `shaders_public.json` for offline use (synchronous)
  // Compact form: only includes `info.id` and `info.name` for each shader so
  // consumers get the full 15-entry list immediately without the large code blobs.
  window.SHADERS_PUBLIC = {
    "userName": "AxleMike",
    "date": "2026-02-28T18:09:47.776Z",
    "numShaders": 15,
    "shaders": [
      { "info": { "id": "Xls3DM", "name": "A Simple Ray Tracer" }, "hasMouse": true },
      { "info": { "id": "XlfSzj", "name": "Simple Text Example" }, "hasMouse": true },
      { "info": { "id": "XtjSDh", "name": "Parallax Scrolling Star Field" }, "hasMouse": true },
      { "info": { "id": "XtSXzK", "name": "Noise Functions: 1" }, "hasMouse": true },
      { "info": { "id": "lstGzf", "name": "Mass Effect - Mass Relay" }, "hasMouse": true },
      { "info": { "id": "lst3W2", "name": "Shadertris" }, "hasMouse": true, "hasKeyboard": true },
      { "info": { "id": "4sKGDG", "name": "PBR Editor" }, "hasMouse": true, "hasKeyboard": true },
      { "info": { "id": "4ltGD8", "name": "Bomberman" }, "hasMouse": true, "hasKeyboard": true },
      { "info": { "id": "MtV3Ry", "name": "Colored Mandelbrot Set" }, "hasMouse": true },
      { "info": { "id": "XtK3Rt", "name": "Silly Spiral" }, "hasMouse": true },
      { "info": { "id": "XlcSRf", "name": "2D Rope Example" }, "hasMouse": true },
      { "info": { "id": "4tVSzz", "name": "Open Sign" }, "hasMouse": false },
      { "info": { "id": "MlyXR1", "name": "Simple Shadowmap" }, "hasMouse": true },
      { "info": { "id": "ltGXRV", "name": "Parallax Mapping Comparision" }, "hasMouse": true },
      { "info": { "id": "4lKSzK", "name": "Worley/Cell Noise" }, "hasMouse": true }
    ]
  };

  // Async attempt to overwrite with hosted copy when available (relative path)
  (async function(){
    try{
      const res = await fetch('shadertoys/shaders_public.json');
      if(res && res.ok){
        const json = await res.json();
        if(json && json.shaders){
          try{ window.SHADERS_PUBLIC = json; console.info('shaders_public_fallback: overwritten by hosted copy'); }
          catch(e){ console.warn('shaders_public_fallback: overwrite failed', e); }
        }
      }
    }catch(e){ /* likely offline/file:// - keep embedded payload */ }
  })();

})();
