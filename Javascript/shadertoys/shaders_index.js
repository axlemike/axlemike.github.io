// Minimal fallback index kept for compatibility; prefer full embedded payload.
// This file will also actively attempt to load the full `shaders_public_fallback.js`
// if `window.SHADERS_PUBLIC` is missing or incomplete so offline usage shows the
// full shader list without requiring a file upload.
window.SHADERS_FALLBACK = [
    { title: 'A Simple Ray Tracer', id: 'Xls3DM', hasMouse: true },
    { title: 'Simple Text Example', id: 'XlfSzj', hasMouse: true },
    { title: 'Parallax Scrolling Star Field', id: 'XtjSDh', hasMouse: true },
    { title: 'Noise Functions: 1', id: 'XtSXzK', hasMouse: true },
    { title: 'Mass Effect - Mass Relay', id: 'lstGzf', hasMouse: true },
    { title: 'Shadertris', id: 'lst3W2', hasMouse: true, hasKeyboard: true },
    { title: 'PBR Editor', id: '4sKGDG', hasMouse: true, hasKeyboard: true },
    { title: 'Bomberman', id: '4ltGD8', hasMouse: true, hasKeyboard: true },
    { title: 'Colored Mandelbrot Set', id: 'MtV3Ry', hasMouse: true },
    { title: 'Silly Spiral', id: 'XtK3Rt', hasMouse: true },
    { title: '2D Rope Example', id: 'XlcSRf', hasMouse: true },
    { title: 'Open Sign', id: '4tVSzz', hasMouse: true },
    { title: 'Simple Shadowmap', id: 'MlyXR1', hasMouse: true },
    { title: 'Parallax Mapping Comparision', id: 'ltGXRV', hasMouse: true },
    { title: 'Worley/Cell Noise', id: '4lKSzK', hasMouse: true }
];

// If a full `SHADERS_PUBLIC` payload already exists, keep it.
if (window && window.SHADERS_PUBLIC && window.SHADERS_PUBLIC.shaders && window.SHADERS_PUBLIC.shaders.length) {
    console.info('shaders_index: full SHADERS_PUBLIC present; keeping it (fallback index preserved)');
} else {
    // Ensure the full fallback is loaded quickly (cache-busted) so the grid sees the
    // complete payload before rendering. This helps file:// and stale-cache cases.
    try {
        var script = document.createElement('script');
        script.src = 'Javascript/shadertoys/shaders_public_fallback.js?v=' + Date.now();
        script.onload = function(){
            console.info('shaders_index: loaded shaders_public_fallback.js, SHADERS_PUBLIC length=', (window.SHADERS_PUBLIC && window.SHADERS_PUBLIC.shaders && window.SHADERS_PUBLIC.shaders.length));
        };
        script.onerror = function(){
            console.warn('shaders_index: failed to load full fallback; leaving short index in place');
            // As a last resort, expose a minimal SHADERS_PUBLIC so consumers see something
            try {
                if (!window.SHADERS_PUBLIC) window.SHADERS_PUBLIC = { shaders: window.SHADERS_FALLBACK.map(function(f){ return { info: { name: f.title, id: f.id }, url: 'https://www.shadertoy.com/view/' + f.id, hasMouse: !!f.hasMouse, hasKeyboard: !!f.hasKeyboard }; }) };
            } catch (e) {}
        };
        (document.head || document.documentElement).appendChild(script);
        // Do NOT expose the short `SHADERS_PUBLIC` immediately — allow the full
        // `shaders_public_fallback.js` to load and set the canonical payload. If
        // the injected script fails to load, the `onerror` handler below will
        // create the minimal `SHADERS_PUBLIC` as a last resort.
    } catch (e) {
        console.warn('shaders_index: could not inject full fallback script', e);
    }
}
