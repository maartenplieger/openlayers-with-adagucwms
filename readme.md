# OpenLayers demo with adaguc-server Web Map Service from geoservices

Autor: Maarten Plieger (KNMI) - maarten.plieger@knmi.nl

This uses openlayers to display statically loaded images from a adaguc WMS service for Harmonie. It combines air temperature, pressure and precipitation in one layer.
 It is possible to change the projection of the loaded images. You can choose mercator or europe polar stereographic projection. Openlayers will transform the imagery to mercator.


![OpenLayers-and-adaguc-server-WMS](./OpenLayers-and-adaguc-server-WMS.webm)

## Demo code

Check my-app/main.ts for the details

## To run:

```
npm ci
npm start
```

visit the advertised urls
