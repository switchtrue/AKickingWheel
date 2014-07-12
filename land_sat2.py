import httplib, urllib
import simplejson as json
import xml.etree.ElementTree as ET
from owslib.wcs import WebCoverageService
import utils
import sys, os

HOST_NAME = 'eos.ga.gov.au'
HOST_PORT = 80
HOST_PATH = '/geonetwork/srv/eng/csw'

# - lc
# - uc

#bounding_box = (141.9368, -32.8835, 142.4735, -32.4970)

(149.118368, -35.271229, 150.118368, -35.771229)


def get_records(post_code_for_bounding_box):

    pc_info = utils.post_codes[int(post_code_for_bounding_box)]

    print "Getting images for: %s - %s, %s" % (post_code_for_bounding_box, pc_info['suburb'], pc_info['state'])

    lower_corner = '%s %s' % (float(pc_info['lon']) - 1.0, float(pc_info['lat']) - 0.5)
    lower_corner_sml = '%s %s' % (float(pc_info['lon']) - 0.2, float(pc_info['lat']) - 0.1)
    upper_corner = '%f %f' % (float(pc_info['lon']) + 1.0, float(pc_info['lat']) + 0.5)
    upper_corner_sml = '%f %f' % (float(pc_info['lon']) + 0.2, float(pc_info['lat']) + 0.1)

    body = """<?xml version="1.0" encoding="UTF-8"?>
<csw:GetRecords xmlns:gml="http://www.opengis.net/gml"
xmlns:ogc="http://www.opengis.net/ogc"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xmlns:csw="http://www.opengis.net/cat/csw/2.0.2"
outputSchema="http://www.opengis.net/cat/csw/2.0.2"
outputFormat="application/xml" version="2.0.2" service="CSW"
resultType="results" maxRecords="10" nextRecord="0"
xsi:schemaLocation="http://www.opengis.net/cat/csw/2.0.2
http://schemas.opengis.net/csw/2.0.2/CSW-discovery.xsd">
<csw:Query typeNames="csw:Record">
<csw:ElementSetName>full</csw:ElementSetName>
<csw:Constraint version="1.1.0">
<ogc:Filter>
<ogc:And>
<ogc:PropertyIsLike escape="\" singleChar="_" wildCard="%">
<ogc:PropertyName>Title</ogc:PropertyName>
<ogc:Literal>%Landsat%</ogc:Literal>
</ogc:PropertyIsLike>
<ogc:BBOX>
<ogc:PropertyName>ows:BoundingBox</ogc:PropertyName>
<gml:Envelope>
<gml:lowerCorner>""" + lower_corner_sml + """</gml:lowerCorner> 
<gml:upperCorner>""" + upper_corner_sml + """</gml:upperCorner>
</gml:Envelope>
</ogc:BBOX>
</ogc:And>
</ogc:Filter>
</csw:Constraint>
<ogc:SortBy>
<ogc:SortProperty>
<ogc:PropertyName>apiso:TempExtent_begin</ogc:PropertyName>
<ogc:SortOrder>ASC</ogc:SortOrder>
</ogc:SortProperty>
</ogc:SortBy>
</csw:Query>
</csw:GetRecords>"""

    headers = {
        'Accept-Encoding': 'gzip,deflate',
        'Content-Type': 'text/xml;charset=UTF-8',
        'Content-Length': len(body),
        'Host': HOST_NAME,
        'Connection': 'Keep-Alive',
        'User-Agent': 'GovHack - Team A Kicking Wheel'
        }

    #request_path = '%s?%s&format=json' % (HOST_PATH, query_params)
    request_path = '%s?request=GetRecords' % (HOST_PATH)

    conn = httplib.HTTPConnection(HOST_NAME, HOST_PORT)
    conn.request('POST', request_path, body, headers)
    response = conn.getresponse()

    print 'GetRecords: %d %s' % (response.status, response.reason)

    if response.status == 200:
        data = response.read()
        conn.close()
        
        result_tree = ET.ElementTree(ET.fromstring(data))

        namespaces = {
            'csw': 'http://www.opengis.net/cat/csw/2.0.2',
            'dc': 'http://purl.org/dc/elements/1.1/',
            'ows': 'http://www.opengis.net/ows',
            }
        results = result_tree.getroot().findall(
            'csw:SearchResults/csw:Record', namespaces=namespaces
            )

        for result in results:
            get_capabilities_response = result.find(
                "dc:URI[@protocol='OGC:WCS']",
                namespaces=namespaces
                )
            wcs_url = get_capabilities_response.text
            print 'Record URL: %s' % wcs_url

            service = WebCoverageService(wcs_url, version='1.0.0')
            
            for content in service.contents:
                bounding_box_strs = lower_corner_sml.split(' ') + upper_corner_sml.split(' ')
                bounding_box = tuple([float(i) for i in bounding_box_strs])

                print 'Bounding Box: ' + str(bounding_box)

                img = service.getCoverage(identifier=content, bbox=bounding_box, format='GeoTIFF')

                identifier = result.find('dc:identifier', namespaces=namespaces).text
                directory = 'landsat_images/%s' % pc_info['suburb']

                if not os.path.exists(directory):
                    os.makedirs(directory)

                file_name = '%s/%s_%s.png' % (directory, identifier, content)

                print 'Writing file: %s' % file_name

                out = open(file_name, 'wb')
                out.write(img.read())
                out.close()

get_records(sys.argv[1])