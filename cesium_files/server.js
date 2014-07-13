var host_name = 'eos.ga.gov.au';
var host_port = 80;
var host_path = '/geonetwork/srv/eng/csw';

var default_directory = 'landsat_images/';

var image_list = {};

var max_records = 500;
var get_records_body_template = '<?xml version="1.0" encoding="UTF-8"?><csw:GetRecords xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:csw="http://www.opengis.net/cat/csw/2.0.2" outputSchema="http://www.opengis.net/cat/csw/2.0.2" outputFormat="application/xml" version="2.0.2" service="CSW" resultType="results" maxRecords="${MAX_RECORDS}" nextRecord="0" xsi:schemaLocation="http://www.opengis.net/cat/csw/2.0.2http://schemas.opengis.net/csw/2.0.2/CSW-discovery.xsd"><csw:Query typeNames="csw:Record"><csw:ElementSetName>full</csw:ElementSetName><csw:Constraint version="1.1.0"><ogc:Filter><ogc:And><ogc:PropertyIsLike escape="\" singleChar="_" wildCard="%"><ogc:PropertyName>Title</ogc:PropertyName><ogc:Literal>%Landsat%</ogc:Literal></ogc:PropertyIsLike><ogc:BBOX><ogc:PropertyName>ows:BoundingBox</ogc:PropertyName><gml:Envelope><gml:lowerCorner>${LOWER_CORNER}</gml:lowerCorner> <gml:upperCorner>${UPPER_CORNER}</gml:upperCorner></gml:Envelope></ogc:BBOX></ogc:And></ogc:Filter></csw:Constraint><ogc:SortBy><ogc:SortProperty><ogc:PropertyName>apiso:TempExtent_begin</ogc:PropertyName><ogc:SortOrder>ASC</ogc:SortOrder></ogc:SortProperty></ogc:SortBy></csw:Query></csw:GetRecords>';
var wms_url_template = '${WMS_URL}?layers=FalseColour741&styles=&srs=EPSG:4326&format=image/png&request=GetMap&bgcolor=0xFFFFFF&height=746&width=1036&version=1.1.1&bbox=${BBOX}&exceptions=application/vnd.ogc.se_xml&transparent=FALSE';

(function() {
    "use strict";
    /*global console,require,__dirname*/
    /*jshint es3:false*/

    var express = require('express');
    var compression = require('compression');
    var url = require('url');
    var request = require('request');
    var fs = require('fs');
    var http = require('http');

    var yargs = require('yargs').options({
        'port' : {
            'default' : 8080,
            'description' : 'Port to listen on.'
        },
        'public' : {
            'type' : 'boolean',
            'description' : 'Run a public server that listens on all interfaces.'
        },
        'upstream-proxy' : {
            'description' : 'A standard proxy server that will be used to retrieve data.  Specify a URL including port, e.g. "http://proxy:8000".'
        },
        'bypass-upstream-proxy-hosts' : {
            'description' : 'A comma separated list of hosts that will bypass the specified upstream_proxy, e.g. "lanhost1,lanhost2"'
        },
        'help' : {
            'alias' : 'h',
            'type' : 'boolean',
            'description' : 'Show this help.'
        }
    });
    var argv = yargs.argv;

    if (argv.help) {
        return yargs.showHelp();
    }

    // eventually this mime type configuration will need to change
    // https://github.com/visionmedia/send/commit/d2cb54658ce65948b0ed6e5fb5de69d022bef941
    var mime = express.static.mime;
    mime.define({
        'application/json' : ['czml', 'json', 'geojson'],
        'text/plain' : ['glsl']
    });

    var app = express();
    app.use(compression());
    app.use(express.static(__dirname));

    function getRemoteUrlFromParam(req) {
        var remoteUrl = req.params[0];
        if (remoteUrl) {
            // add http:// to the URL if no protocol is present
            if (!/^https?:\/\//.test(remoteUrl)) {
                remoteUrl = 'http://' + remoteUrl;
            }
            remoteUrl = url.parse(remoteUrl);
            // copy query string
            remoteUrl.search = url.parse(req.url).search;
        }
        return remoteUrl;
    }

    var dontProxyHeaderRegex = /^(?:Host|Proxy-Connection|Connection|Keep-Alive|Transfer-Encoding|TE|Trailer|Proxy-Authorization|Proxy-Authenticate|Upgrade)$/i;

    function filterHeaders(req, headers) {
        var result = {};
        // filter out headers that are listed in the regex above
        Object.keys(headers).forEach(function(name) {
            if (!dontProxyHeaderRegex.test(name)) {
                result[name] = headers[name];
            }
        });
        return result;
    }

    function readjs(f) {
      return fs.readFileSync(f).toString();
    }
    
    function includejs(f) {
      eval.apply(global, [readjs(f)]);
    }

    var landsat_processing_status = {};

    function get_records(post_code, gr_callback, id) {

      fs.mkdir(default_directory, function(e){
        if(!e || (e && e.code === 'EEXIST')){
          return; // it exists, thats good.
        } else {
          console.log(e);
        }
      });

      var pc_info = post_codes[parseInt(post_code)];
      
      // It would be nice to use this smaller bounding box but we ge bad low res images.
      // var lc_lon = parseFloat(parseFloat(pc_info.lon).toFixed(4)) - 0.05;
      // var lc_lat = parseFloat(parseFloat(pc_info.lat).toFixed(4)) - 0.025;
      // var uc_lon = parseFloat(parseFloat(pc_info.lon).toFixed(4)) + 0.05;
      // var uc_lat = parseFloat(parseFloat(pc_info.lat).toFixed(4)) + 0.025;

      var lc_lon = parseFloat(parseFloat(pc_info.lon).toFixed(4)) - 0.25;
      var lc_lat = parseFloat(parseFloat(pc_info.lat).toFixed(4)) - 0.125;
      var uc_lon = parseFloat(parseFloat(pc_info.lon).toFixed(4)) + 0.25;
      var uc_lat = parseFloat(parseFloat(pc_info.lat).toFixed(4)) + 0.125;

      var lower_corner = '' + lc_lon + ' ' + lc_lat;
      var upper_corner = '' + uc_lon + ' ' + uc_lat;

      console.log('lower corner: ' + lower_corner);
      console.log('upper corner: ' + upper_corner);

      var body = get_records_body_template;
      body = body.replace('${LOWER_CORNER}', lower_corner);
      body = body.replace('${UPPER_CORNER}', upper_corner);
      body = body.replace('${MAX_RECORDS}', max_records);

      var options = {
        host: host_name,
        port: host_port,
        path: host_path + '?request=GetRecords',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'Content-Length': body.length,
          'User-Agent': 'GovHack - Team A Kicking Wheel'
        }
      };

      var get_records_response = '';

      var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        image_list[id] = [];

        res.on('data', function (chunk) {
          get_records_response += chunk;
        });

        res.on('end', function() {
          var parseString = require('xml2js').parseString;
          var xml = get_records_response;
          parseString(xml, function (err, result) {
            var records = result['csw:GetRecordsResponse']['csw:SearchResults'][0]['csw:Record'];

            for (var i in records) {
              var image = {};

              var identifier = records[i]['dc:identifier'][0];
              var extent_begin = records[i]['ows:TempExtent_begin'][0];
              var file_name = default_directory + identifier + '.png';

              image['url'] = file_name;
              image['date_recorded'] = extent_begin.substr(0, extent_begin.indexOf('T'));
              image['bbox'] = [lc_lon, lc_lat, uc_lon, uc_lat];

              var uris = records[i]['dc:URI'];
              var wms_url;
              for (var j in uris) {
                if (uris[j]['$']['protocol'] === 'OGC:WMS-1.3.0-http-get-capabilities') {
                  wms_url = uris[j]['_'];
                  break;
                }
              }

              var record_wms_url = wms_url_template;
              record_wms_url = record_wms_url.replace('${WMS_URL}', wms_url);
              record_wms_url = record_wms_url.replace('${BBOX}', '' + lc_lon + ',' + lc_lat + ',' + uc_lon + ',' + uc_lat);

              get_map(record_wms_url, file_name);

              image_list[id].push(image);

              console.log('current: i: ' + i + ', len: ' + records.length);
              if (i == records.length - 1) {
                console.log('About to do callback');
                console.log(gr_callback);
                gr_callback.call(this, image_list[id]);
              }

            }
          });

          //console.log(image_list);

        });

      });

      req.write(body);

      req.end();
    }

    function get_map(get_map_wms_url, file_location) {
      var image_response;

      if (fs.existsSync(file_location)) {
        return;
      }

      http.get(get_map_wms_url, function(res) {
        var imagedata = '';
        res.setEncoding('binary');

        res.on('data', function(chunk){
          imagedata += chunk;
        });

        res.on('end', function(){
          fs.writeFileSync(file_location, imagedata, 'binary', function(err){
            if (err) throw err;
            console.log('File saved: ' + file_location);
          });
        });
      });
    }

    var upstreamProxy = argv['upstream-proxy'];
    var bypassUpstreamProxyHosts = {};
    if (argv['bypass-upstream-proxy-hosts']) {
        argv['bypass-upstream-proxy-hosts'].split(',').forEach(function(host) {
            bypassUpstreamProxyHosts[host.toLowerCase()] = true;
        });
    }

    app.get('/proxy/*', function(req, res, next) {
        // look for request like http://localhost:8080/proxy/http://example.com/file?query=1
        var remoteUrl = getRemoteUrlFromParam(req);
        if (!remoteUrl) {
            // look for request like http://localhost:8080/proxy/?http%3A%2F%2Fexample.com%2Ffile%3Fquery%3D1
            remoteUrl = Object.keys(req.query)[0];
            if (remoteUrl) {
                remoteUrl = url.parse(remoteUrl);
            }
        }

        if (!remoteUrl) {
            return res.send(400, 'No url specified.');
        }

        if (!remoteUrl.protocol) {
            remoteUrl.protocol = 'http:';
        }

        var proxy;
        if (upstreamProxy && !(remoteUrl.host in bypassUpstreamProxyHosts)) {
            proxy = upstreamProxy;
        }

        // encoding : null means "body" passed to the callback will be raw bytes

        request.get({
            url : url.format(remoteUrl),
            headers : filterHeaders(req, req.headers),
            encoding : null,
            proxy : proxy
        }, function(error, response, body) {
            var code = 500;

            if (response) {
                code = response.statusCode;
                res.header(filterHeaders(req, response.headers));
            }

            res.send(code, body);
        });
    });

    app.get('/landsat_actions/begin', function(req, res, next) {
        if (req.query.postcode) {
            includejs('reference_data.js');
            get_records(req.query.postcode, function(data) {
                landsat_processing_status[landsat_id] = data;
            });
            // Awful hack for want of a better way for now.
            var landsat_id = parseInt(Math.random() * 100000000);
            landsat_processing_status[landsat_id] = 'PROCESSING';
            res.send(200, JSON.stringify({status: "OK", id: landsat_id}));
        } else {
            res.send(500, 'No postcode was provided in the URL query.');
        }
    });

    app.get('/landsat_actions/get_processing_status', function(req, res, next) {
        if (req.query.id) {
            var landsat_id = req.query.id;
            var status = landsat_processing_status[landsat_id];
            if (status === 'PROCESSING') {
                res.send(200, JSON.stringify({status: "PROCESSING"}));
            } else {
                delete landsat_processing_status[landsat_id];
                delete image_list[landsat_id];
                res.send(200, JSON.stringify({status: "COMPLETE", data: JSON.stringify(status)}));
            }
        } else {
            res.send(500, JSON.stringify({status: "ERROR"}));
        }
    });

    app.listen(argv.port, argv.public ? undefined : 'localhost');

    console.log('Cesium development server running.  Connect to http://localhost:%d.', argv.port);
})();
