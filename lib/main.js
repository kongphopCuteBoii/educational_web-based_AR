<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    
    <!-- ADD THIS: The Mobile Console Library -->
    <script src="https://unpkg.com/vconsole@latest/dist/vconsole.min.js"></script>
    <script>
      // Initialize the console immediately
      var vConsole = new VConsole();
    </script>
    <!-- END OF ADDITION -->

    <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
        "gltfloader": "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js",
        "mindar-image-three":"https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js"
      }
    }
    </script>
    <script src="lib/main.js" type="module"></script>
    <style>
      body { margin: 0; }
      #container { width: 100vw; height: 100vh; position: relative; overflow: hidden; }
      #control { position: absolute; top: 10px; left: 10px; z-index: 10; }
    </style>
  </head>
  <body>
    <div id="control">
      <button id="startButton">Start AR</button>
      <button id="stopButton">Stop AR</button>
    </div>
    <div id="container"></div>
  </body>
</html>
