import httplib, urllib
import simplejson as json
import xml.etree.ElementTree as ET
from owslib.wms import WebMapService

HOST_NAME = 'eos.ga.gov.au'
HOST_PORT = 80
HOST_PATH = '/geonetwork/srv/eng/csw'

def get_records():
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
<gml:lowerCorner>141.9368 -32.8835</gml:lowerCorner>
<gml:upperCorner>142.4735 -32.4970</gml:upperCorner>
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
            print result
            get_capabilities_response = result.find(
                "dc:URI[@protocol='OGC:WMS-1.3.0-http-get-capabilities']",
                namespaces=namespaces
                )
            wms_url = get_capabilities_response.text
            print wms_url

            service = WebMapService(wms_url, version='1.1.1')

            lower_corner = result.find('ows:BoundingBox/ows:LowerCorner',
                namespaces=namespaces
                ).text
            upper_corner = result.find('ows:BoundingBox/ows:UpperCorner',
                namespaces=namespaces
                ).text

            bounding_box_strs = lower_corner.split(' ') + upper_corner.split(' ')
            #bounding_box = tuple([float(i) for i in bounding_box_strs])

            bounding_box = (141.9368, -32.8835, 142.4735, -32.4970)

            print bounding_box

            img = service.getmap(
                layers=['FalseColour741'], styles=[''],
                srs='EPSG:4326', bbox=bounding_box, size=(1036, 746),
                format='image/png'#, transparent=True
                )

            identifier = result.find('dc:identifier', namespaces=namespaces).text

            out = open('%s.png' % identifier, 'wb')
            out.write(img.read())
            out.close()

get_records()