
function get_records(post_code) {

  fs.mkdir(default_directory, function(e){
    if(!e || (e && e.code === 'EEXIST')){
      return; // it exists, thats good.
    } else {
      console.log(e);
    }
  });

  var pc_info = post_codes[parseInt(post_code)];
  
  var lc_lon = parseFloat(parseFloat(pc_info.lon).toFixed(4));
  var lc_lat = parseFloat(parseFloat(pc_info.lat).toFixed(4));
  var uc_lon = parseFloat(parseFloat(pc_info.lon).toFixed(4)) + 1.0;
  var uc_lat = parseFloat(parseFloat(pc_info.lat).toFixed(4)) + 0.5;

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

          image_list.push(image);
        }
      });

      console.log(image_list);

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
      fs.writeFile(file_location, imagedata, 'binary', function(err){
        if (err) throw err;
        console.log('File saved: ' + file_location);
      });
    });
  });
}

get_records(2612);