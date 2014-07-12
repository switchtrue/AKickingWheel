var http = require('http');
var fs = require('fs');

var host_name = 'eos.ga.gov.au';
var host_port = 80;
var host_path = '/geonetwork/srv/eng/csw';

var default_directory = 'landsat_images/';

var image_list = [];

var get_records_body_template = '<?xml version="1.0" encoding="UTF-8"?><csw:GetRecords xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:csw="http://www.opengis.net/cat/csw/2.0.2" outputSchema="http://www.opengis.net/cat/csw/2.0.2" outputFormat="application/xml" version="2.0.2" service="CSW" resultType="results" maxRecords="5" nextRecord="0" xsi:schemaLocation="http://www.opengis.net/cat/csw/2.0.2http://schemas.opengis.net/csw/2.0.2/CSW-discovery.xsd"><csw:Query typeNames="csw:Record"><csw:ElementSetName>full</csw:ElementSetName><csw:Constraint version="1.1.0"><ogc:Filter><ogc:And><ogc:PropertyIsLike escape="\" singleChar="_" wildCard="%"><ogc:PropertyName>Title</ogc:PropertyName><ogc:Literal>%Landsat%</ogc:Literal></ogc:PropertyIsLike><ogc:BBOX><ogc:PropertyName>ows:BoundingBox</ogc:PropertyName><gml:Envelope><gml:lowerCorner>${LOWER_CORNER}</gml:lowerCorner> <gml:upperCorner>${UPPER_CORNER}</gml:upperCorner></gml:Envelope></ogc:BBOX></ogc:And></ogc:Filter></csw:Constraint><ogc:SortBy><ogc:SortProperty><ogc:PropertyName>apiso:TempExtent_begin</ogc:PropertyName><ogc:SortOrder>ASC</ogc:SortOrder></ogc:SortProperty></ogc:SortBy></csw:Query></csw:GetRecords>';
var wms_url_template = '${WMS_URL}?layers=FalseColour741&styles=&srs=EPSG:4326&format=image/png&request=GetMap&bgcolor=0xFFFFFF&height=746&width=1036&version=1.1.1&bbox=${BBOX}&exceptions=application/vnd.ogc.se_xml&transparent=FALSE';

function get_records(post_code) {

  fs.mkdir(default_directory, function(e){
    if(!e || (e && e.code === 'EEXIST')){
      return; // it exists, thats good.
    } else {
      console.log(e);
    }
  });
  
  var lower_corner = '141.9368 -32.8835';
  var upper_corner = '142.4735 -32.4970';

  var body = get_records_body_template;
  body = body.replace('${LOWER_CORNER}', lower_corner);
  body = body.replace('${UPPER_CORNER}', upper_corner);

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
          image['bbox'] = [141.9367, -32.8835, 142.4734, -32.4970];

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
          record_wms_url = record_wms_url.replace('${BBOX}', '141.9368,-32.8835,142.4735,-32.4970');

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

get_records();