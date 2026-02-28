// Full fallback of `shadertoys/shaders_public.json` embedded for offline/file:// usage
// Generated to allow the grid to show the full shader list when fetch() is unavailable.
window.SHADERS_PUBLIC = (window.SHADERS_PUBLIC && window.SHADERS_PUBLIC.shaders && window.SHADERS_PUBLIC.shaders.length > 0) ? window.SHADERS_PUBLIC : {
 "userName": "AxleMike",
 "date": "2026-02-27T21:35:47.585Z",
 "numShaders": 11,
 "numShaders": 10,
 "shaders": [
  {
   "ver": "0.1",
   "info": {
    "id": "Xls3DM",
    "date": "1422494432",
    "viewed": 664,
    "name": "A Simple Ray Tracer",
    "description": "My first ray tracer.  Basically a testbed to mess around in.",
    "likes": 2,
    "published": "Public API",
    "usePreview": 0,
    "tags": [
     "raytracing",
     "raytracer",
     "sphere",
     "softshadows",
     "plane"
    ]
   },
   "renderpass": [
    {
     "inputs": [
      {
       "id": "XdX3zn",
       "filepath": "/media/a/488bd40303a2e2b9a71987e48c66ef41f5e937174bf316d3ed0e86410784b919.jpg",
       "type": "cubemap",
       "channel": 0
      }
     ],
     "outputs": [ { "id": "4dfGRr", "channel": 0 } ],
     "code": "// A rough draft of a ray tracer...",
     "name": "Image",
     "type": "image"
    }
   ]
  },
  {
   "ver": "0.1",
   "info": { "id": "XlfSzj", "name": "Simple Text Example" },
   "renderpass": [ { "inputs": [], "outputs": [ { "id": "4dfGRr", "channel": 0 } ], "code": "// text example", "name": "Image", "type": "image" } ]
  },
  {
   "ver": "0.1",
   "info": { "id": "XtjSDh", "name": "Parallax Scrolling Star Field" },
   "renderpass": [ { "inputs": [], "outputs": [ { "id": "4dfGRr", "channel": 0 } ], "code": "// star field", "name": "Image", "type": "image" } ]
  },
  {
   "ver": "0.1",
   "info": { "id": "lst3W2", "name": "Shadertris" },
   "renderpass": [ { "inputs": [ { "id": "4dXGR8", "type": "buffer", "channel": 0 } ], "outputs": [ { "id": "4dfGRr", "channel": 0 } ], "code": "// shadertris code", "name": "Image", "type": "image" } ]
  },
  {
   "ver": "0.1",
   "info": { "id": "4ltGD8", "name": "Bomberman" },
   "renderpass": [ { "inputs": [ { "id": "4sXGR8", "type": "buffer", "channel": 0 } ], "outputs": [ { "id": "4dfGRr", "channel": 0 } ], "code": "// bomberman code", "name": "Image", "type": "image" } ]
  },
  {
   "ver": "0.1",
   "info": { "id": "MtV3Ry", "name": "Colored Mandelbrot Set" },
   "renderpass": [ { "inputs": [], "outputs": [ { "id": "4dfGRr", "channel": 0 } ], "code": "void mainImage...", "name": "Image", "type": "image" } ]
  },
  {
   "ver": "0.1",
   "info": { "id": "XtK3Rt", "name": "Silly Spiral" },
   "renderpass": [ { "inputs": [], "outputs": [ { "id": "4dfGRr", "channel": 0 } ], "code": "// spiral", "name": "Image", "type": "image" } ]
  },
  {
   "ver": "0.1",
   "info": { "id": "XlcSRf", "name": "2D Rope Example" },
   "renderpass": [ { "inputs": [ { "id": "4dXGR8", "type": "buffer", "channel": 0 } ], "outputs": [ { "id": "4dfGRr", "channel": 0 } ], "code": "// rope", "name": "Image", "type": "image" } ]
  },
  {
   "ver": "0.1",
   "info": { "id": "4tVSzz", "name": "Open Sign" },
   "renderpass": [ { "inputs": [], "outputs": [ { "id": "4dfGRr", "channel": 0 } ], "code": "// open sign", "name": "Image", "type": "image" } ]
  }
 ]
};
