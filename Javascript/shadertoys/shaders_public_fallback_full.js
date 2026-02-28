(async function(){
  // Try to load the canonical JSON (works when served over HTTP)
  try{
    const res = await fetch('shadertoys/shaders_public.json');
    if(res.ok){
      window.SHADERS_PUBLIC = await res.json();
      return;
    }
  }catch(e){}

  // If fetch failed (likely offline/file://), ensure the two known-missing shaders are present
  const missingShaders = [
    {
      "ver": "0.1",
      "info": {
        "id": "MlyXR1",
        "date": "1484513120",
        "viewed": 1299,
        "name": "Simple Shadowmap",
        "description": "A simple sdf shadowmap example.  Still need to fix aliasing/artifact issues.",
        "likes": 9,
        "published": "Public API",
        "usePreview": 0,
        "tags": ["3d","sdf","shadow","spotlight","multipass","shadowmap"]
      },
      "renderpass": [
        {
          "inputs": [ { "id":"4dXGR8","filepath":"/media/previz/buffer00.png","type":"buffer","channel":0,"sampler":{ "filter":"linear","wrap":"clamp","vflip":"true","srgb":"false","internal":"byte"},"published":1} ],
          "outputs": [ { "id":"4dfGRr","channel":0} ],
          "code": "...shadowmap shader code..."
        },
        {
          "inputs": [  ],
          "outputs": [ { "id":"4dXGR8","channel":0 } ],
          "code": "...buffer A code for shadowmap...",
          "name": "Buffer A",
          "description":"",
          "type":"buffer"
        },
        {
          "inputs": [],
          "outputs": [ { "id":"4dXGR8","channel":0 } ],
          "code": "...shadowmap helper buffer...",
          "name":"Buffer A",
          "description":"",
          "type":"buffer"
        }
      ]
    },
    {
      "ver": "0.1",
      "info": {
        "id": "4lKSzK",
        "date": "1485061275",
        "viewed": 672,
        "name": "Worley/Cell Noise",
        "description": "Worley and Cell Noise\nHopefully I'm doing this right.",
        "likes": 6,
        "published": "Public API",
        "usePreview": 0,
        "tags": ["2d","noise","worley","cell"]
      },
      "renderpass": [
        {
          "inputs": [],
          "outputs": [ { "id":"4dfGRr","channel":0 } ],
          "code": "vec2 Hash2D(in vec2 p)\n{\n    return fract(sin(p * mat2(12.98, 78.23, 127.99, 311.33)) * 43758.54);\n}\n\nvec3 DisplayNoise(in vec4 d)\n{\n    float toggle = mod(floor(iTime * 0.5), 6.0);\n    \n    vec3 color = d.xxx;\n    \n    if(toggle == 1.0) \t\tcolor = vec3(1.0 - d.x);\n    else if(toggle == 2.0) \tcolor = vec3(d.y - d.x);     \n    else if(toggle == 3.0) \tcolor = vec3(d.z - d.y);\n    else if(toggle == 4.0) \tcolor = vec3(d.z - d.x);  \n    else if(toggle == 5.0) \tcolor = d.xyz;   \n    \n    return color;\n}\n\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord)\n{\n\tvec2 uv = fragCoord.xy / iResolution.yy * 12.0;\n    vec2 i = floor(uv);\n    vec2 n = fract(uv);\n    vec4 minD = vec4(9.0);\n    \n    for (float y = -1.0; y <= 1.0; ++y) \n    {\n        for(float x = -1.0; x <= 1.0; ++x) \n        {\n            vec2 point = sin(iTime + 32.0 * Hash2D(i + vec2(x, y))) * 0.5 + 0.5;\n            float d = length(vec2(x, y) + point - n);\n            \n            minD = (d < minD.x) ? vec4(d, minD.xyz) \n               \t : (d < minD.y) ? vec4(minD.x, d, minD.yz) \n               \t : (d < minD.z) ? vec4(minD.xy, d, minD.z) \n               \t : (d < minD.w) ? vec4(minD.xyz, d) \n                 : minD;\n        }\n    }\n    fragColor = vec4(DisplayNoise(minD), 1.0);\n}",
          "name":"Image",
          "description":"",
          "type":"image"
        }
      ]
    }
  ];

  // Merge into any existing fallback or create a new one
  if(window.SHADERS_PUBLIC && Array.isArray(window.SHADERS_PUBLIC.shaders)){
    const existing = window.SHADERS_PUBLIC.shaders;
    const ids = new Set(existing.map(s => s.info && s.info.id));
    let added = 0;
    for(const s of missingShaders){
      if(!ids.has(s.info.id)){
        existing.push(s);
        added++;
      }
    }
    if(added) window.SHADERS_PUBLIC.numShaders = existing.length;
  } else {
    window.SHADERS_PUBLIC = {
      userName: "AxleMike",
      date: new Date().toISOString(),
      numShaders: missingShaders.length,
      shaders: missingShaders
    };
  }
})();
