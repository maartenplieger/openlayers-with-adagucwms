import "./style.css";
import { Map, View } from "ol";
import proj4 from "proj4";
import { get as getProjection, transformExtent } from "ol/proj.js";
import { register } from "ol/proj/proj4.js";
import ImageLayer from "ol/layer/Image";
import TileLayer from "ol/layer/Tile";
import Projection from "ol/proj/Projection.js";
import Static from "ol/source/ImageStatic.js";
import OSM from "ol/source/OSM";
import { getCenter } from "ol/extent.js";
import { Control, defaults as defaultControls } from "ol/control.js";
import {
  WMGetServiceFromStore,
  LayerProps,
  WMLayer,
  generateLayerId,
  LayerType,
  Dimension,
  WMDateOutSideRange,
  URLEncode,
  WMDateTooLateString,
  WMDateTooEarlyString,
} from "@opengeoweb/webmap";

proj4.defs(
  "EPSG:32661",
  "+proj=stere +lat_0=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs +type=crs"
);

proj4.defs(
  "EPSG:3857",
  "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs"
);

register(proj4);

const proj32661 = getProjection("EPSG:32661");
proj32661!.setExtent([
  -569491.1035575261, -4370824.966741579, 3999635.796053254, 436331.1937775784,
]);

// // Do layer GetMap Requests in mercator projection
// const layerBbox = [-3000000, 5000000, 2000000, 9000000];
// const layerwidth = Math.round((layerBbox[2] - layerBbox[0]) / 2000);
// const layerHeight = Math.round((layerBbox[3] - layerBbox[1]) / 2000);
// const layerCrs = "EPSG:3857";

// Do layer GetMap Requests in europe stereographic projection
const layerBbox = [-530000, -4000000, 4000000, 15000];
const layerwidth = Math.round((layerBbox[2] - layerBbox[0]) / 2000);
const layerHeight = Math.round((layerBbox[3] - layerBbox[1]) / 2000);
const layerCrs = "EPSG:32661";

const harmonieWmsURL =
  "https://geoservices.knmi.nl/adaguc-server?DATASET=uwcw_ha43_dini_5p5km&";
const layerToFind = "air_temperature_hagl";
const wmsCombinedlayers =
  "air_temperature_hagl,total_precipitation_rate_hagl,air_pressure_at_mean_sea_level_hagl";

const olLayerProjection = new Projection({
  code: layerCrs,
  units: "m",
  extent: layerBbox,
});

const olMapProjection = new Projection({
  code: "EPSG:3857",
  units: "m",
  // extent: [-20000000, 5000000, 2000000, 9000000],
});

const makeHarmonieWMSRequest = (layer: WMLayer): string => {
  const getMapProjection = `WIDTH=${layerwidth}&HEIGHT=${layerHeight}&CRS=${layerCrs}&BBOX=${layerBbox.join(
    ","
  )}`;

  const dimensions = getMapDimURL(layer);

  return `${layer.service}&service=WMS&REQUEST=GetMap&LAYERS=${wmsCombinedlayers}&${getMapProjection}&STYLES=temperature_wow%2Fshaded,pressure_cwk%2Fcontour&FORMAT=image/webp&TRANSPARENT=TRUE&${dimensions}`;
};

const overLayer = new ImageLayer({
  source: new Static({
    attributions: "Adaguc",
    url: `https://geoservices.knmi.nl/adaguc-server?DATASET=baselayers&SERVICE=WMS&&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=overlay_europe&WIDTH=${layerwidth}&HEIGHT=${layerHeight}&CRS=${layerCrs}&BBOX=${layerBbox.join(
      ","
    )}&STYLES=default&FORMAT=image/png&TRANSPARENT=TRUE`,
    projection: olLayerProjection,
    imageExtent: layerBbox,
  }),
});

/* Returns all dimensions with its current values as URL */
export const getMapDimURL = (
  layer: WMLayer,
  dimensionOverride?: Dimension[]
): string => {
  let request = "";
  layer.dimensions.forEach((layerDimension) => {
    const overrideDim =
      dimensionOverride &&
      dimensionOverride.find((d) => {
        return d.name === layerDimension.name;
      });
    const dimension = layerDimension;

    const currentValue =
      (overrideDim &&
        dimension.getClosestValue(overrideDim.currentValue, true)) ||
      dimension.currentValue;
    request += `&${dimension.name}`;
    request += `=${URLEncode(currentValue)}`;
    if (
      currentValue === WMDateOutSideRange ||
      currentValue === WMDateTooEarlyString ||
      currentValue === WMDateTooLateString
    ) {
      throw new Error(WMDateOutSideRange);
    }
  });
  return request;
};

const harmonieLayer = new ImageLayer();

const setOpenLayersLayer = (wmLayer: WMLayer) => {
  const getMapRequest = makeHarmonieWMSRequest(wmLayer);
  const s = new Static({
    attributions: "Adaguc",
    url: getMapRequest,
    projection: olLayerProjection,
    imageExtent: layerBbox,
  });
  harmonieLayer.setSource(s);
  const tdtimevalue = document.getElementById("tdtimevalue");

  if (tdtimevalue) {
    tdtimevalue.innerHTML = wmLayer.getDimension("time")?.currentValue!;
  }
  const tdreftimevalue = document.getElementById("tdreftimevalue");
  if (tdreftimevalue) {
    tdreftimevalue.innerHTML =
      wmLayer.getDimension("reference_time")?.currentValue!;
  }

  return getMapRequest;
};

const initHarmonieWMS = async () => {
  const wmService = WMGetServiceFromStore(harmonieWmsURL);
  const getLayer = (): Promise<LayerProps> => {
    return new Promise((resolve, reject) => {
      wmService.getLayerObjectsFlat(
        (layerList) => {
          const layerPropsFiltered = layerList.filter((layer) => {
            return layer.name === layerToFind;
          });
          if (layerPropsFiltered.length === 1) {
            resolve(layerPropsFiltered[0]);
            return;
          }
          reject("not found");
        },
        (e) => {
          console.error(e);
          reject(e);
        },
        false
      );
    });
  };
  const layerProps = await getLayer();
  const wmLayer = new WMLayer({
    id: generateLayerId(),
    service: harmonieWmsURL,
    layerType: LayerType.mapLayer,
    ...layerProps,
    name: layerToFind,
  });

  const layerTimeDim = wmLayer.getDimension("time");
  for (let j = 0; j < 40; j += 1) {
    if (!layerTimeDim) return;
    const currentTimeStep = layerTimeDim.getIndexForValue(
      layerTimeDim.currentValue
    );
    const newTimeValue = layerTimeDim.getValueForIndex(
      currentTimeStep + 1
    ) as string;
    wmLayer.setDimension("time", newTimeValue);
    const getMapRequest = setOpenLayersLayer(wmLayer);
    const preloader = document.getElementById("preloader");
    if (preloader) {
      const i = new Image();
      i.onmouseenter = () => {
        wmLayer.setDimension("time", newTimeValue);
        setOpenLayersLayer(wmLayer);
      };
      preloader.appendChild(i);
      i.src = getMapRequest;
    }
  }
  const newTimeValue = layerTimeDim!.getValueForIndex(0) as string;
  wmLayer.setDimension("time", newTimeValue);
  setOpenLayersLayer(wmLayer);
  return wmLayer;
};

const wmLayer = await initHarmonieWMS();

class TimeStepBack extends Control {
  /**
   * @param {Object} [opt_options] Control options.
   */
  constructor(opt_options) {
    const options = opt_options || {};

    const button = document.createElement("button");
    button.innerHTML = "<";

    const element = document.createElement("div");
    element.className = "back-button ol-unselectable ol-control";
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    });

    button.addEventListener("click", this.click.bind(this), false);
  }

  click() {
    if (!wmLayer) return;
    const layerTimeDim = wmLayer.getDimension("time");
    if (!layerTimeDim) return;
    const currentTimeStep = layerTimeDim.getIndexForValue(
      layerTimeDim.currentValue
    );
    if (currentTimeStep < 1 || currentTimeStep >= layerTimeDim.size()) return;
    const newTimeValue = layerTimeDim.getValueForIndex(
      currentTimeStep - 1
    ) as string;
    wmLayer.setDimension("time", newTimeValue);
    setOpenLayersLayer(wmLayer);
  }
}

class NextTimeStep extends Control {
  /**
   * @param {Object} [opt_options] Control options.
   */
  constructor(opt_options) {
    const options = opt_options || {};

    const button = document.createElement("button");
    button.innerHTML = ">";

    const element = document.createElement("div");
    element.className = "next-button ol-unselectable ol-control";
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    });

    button.addEventListener("click", this.click.bind(this), false);
  }
  click() {
    if (!wmLayer) return;
    const layerTimeDim = wmLayer.getDimension("time");
    if (!layerTimeDim) return;
    const currentTimeStep = layerTimeDim.getIndexForValue(
      layerTimeDim.currentValue
    );
    if (currentTimeStep < 0 || currentTimeStep >= layerTimeDim.size() - 1)
      return;
    const newTimeValue = layerTimeDim.getValueForIndex(
      currentTimeStep + 1
    ) as string;
    wmLayer.setDimension("time", newTimeValue);
    setOpenLayersLayer(wmLayer);
  }
}

const map = new Map({
  controls: defaultControls().extend([
    new TimeStepBack({}),
    new NextTimeStep({}),
  ]),
  target: "map",
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
    harmonieLayer,
    overLayer,
  ],
  view: new View({
    projection: olMapProjection,
    center: getCenter([-1000000, 5000000, 1000000, 9000000]),
    zoom: 5,
    maxZoom: 8,
  }),
});
