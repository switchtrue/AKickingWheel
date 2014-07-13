AKickingWheel
=============

Installation
===

1. Download [Cesium-B30](http://cesiumjs.org/downloads.html)
2. Copy the contents of the cesium_files directory in this repo to the root of you Cesium download.
3. Following the cesium setup [instructions](http://cesiumjs.org/2013/04/12/Cesium-up-and-running/#setting_up_a_web_server).
4. Install xml2js with `npm install xml2js`.
5. Install the node.js Image Magick wrappers `npm install gm`
6. Install Image Magick as per the instructions found [here](http://www.imagemagick.org/script/binary-releases.php).

Configuration
====
1. Open the newly copied server.js (as in installation step 2).
2. At the top of this file set `abs_path` to the absolute file path to you Cesium diretory. 
3. Optionally - set `run_port` to the port that you want the server to run on.
4. Optionally - set `run_host` to the host name that the server will run on.

Running
===
1. Inside your Cesium directory run the command `npm start`.