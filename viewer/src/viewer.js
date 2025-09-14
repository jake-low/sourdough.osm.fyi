import maplibreCSS from "maplibre-gl/dist/maplibre-gl.css";
import viewerCSS from "./viewer.css";
import { Map, NavigationControl, AttributionControl } from "maplibre-gl";
import { point, lineString, polygon, distance, pointToLineDistance, pointToPolygonDistance } from '@turf/turf';
import { h } from 'redom';


// Inject CSS
const maplibreStyle = document.createElement("style");
maplibreStyle.textContent = maplibreCSS;
document.head.appendChild(maplibreStyle);

const viewerStyle = document.createElement("style");
viewerStyle.textContent = viewerCSS;
document.head.appendChild(viewerStyle);


const COLORS = [
  "#f4b8e4",
  "#babbf1",
  "#a6d189",
  "#85c1dc",
  "#81c8be",
  "#a6e3a1",
  "#cfc9c2",
  "#f38ba8",
  "#bb9af7",
  "#f2d5cf",
  "#9ece6a",
  "#f9e2af",
  "#89dceb",
  "#b4befe",
  "#f7768e",
  "#8caaee",
  "#89b4fa",
  "#73daca",
  "#fab387",
  "#7aa2f7",
  "#f2cdcd",
  "#eebebe",
  "#2ac3de",
  "#ef9f76",
  "#74c7ec",
  "#c0caf5",
  "#e5c890",
  "#99d1db",
  "#cba6f7",
  "#94e2d5",
  "#e78284",
  "#ca9ee6",
  "#f5c2e7",
  "#ff9e64",
  "#b4f9f8",
  "#f5e0dc",
  "#7dcfff",
  "#eba0ac",
  "#ea999c",
  "#e0af68",
];

function colorForIdx(i) {
  return COLORS[i % COLORS.length];
}

function getDistanceToFeature(feature, { lng, lat }) {
  const cursor = point([ lng, lat ]);
  const { geometry } = feature;

  switch (geometry.type) {
    case "Point":
      return distance(cursor, geometry);
    case "MultiPoint":
      return Math.min(geometry.coordinates.map(coord => distance(cursor, coord)));
    case "LineString":
      return pointToLineDistance(cursor, geometry);
    case "MultiLineString":
      return Math.min(geometry.coordinates.map(ls => pointToLineDistance(cursor, lineString(ls))));
    case "Polygon":
    case "MultiPolygon":
      return pointToPolygonDistance(cursor, geometry);
    default:
      return Infinity;
  }
}

const TEXT_FONT = ["Noto Sans Regular"];
const TEXT_HALO_COLOR = "#000b16";
const TEXT_HALO_WIDTH = 1;
const TEXT_HALO_BLUR = 0;
const TEXT_SIZE_POINT = 9;
const TEXT_SIZE_LINE = 8;
const TEXT_SIZE_POLYGON = 10;


class ZoomControl {
  onAdd(map) {
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group zoom-control";

    const update = () => {
      this.container.innerHTML = `Z = ${map.getZoom().toFixed(2)}`;
    };

    update();
    map.on("zoom", update);

    return this.container;
  }

  onRemove() {
    this.container.parentNode.removeChild(this.container);
  }
}

// Helper functions for hover interaction
function selectFeaturesByType(features) {
  const points = features.filter(f => ["Point", "MultiPoint"].includes(f.geometry.type));
  const lines = features.filter(f => ["LineString", "MultiLineString"].includes(f.geometry.type));
  const polygons = features.filter(f => ["Polygon", "MultiPolygon"].includes(f.geometry.type));
  
  // prioritize selecting element types that have smaller click targets
  if (points.length > 0) return points;
  else if (lines.length > 0) return lines;
  else return polygons;
}

function clearFeatureStates(features, map) {
  features.forEach(feature => {
    if (feature.id !== undefined) {
      map.setFeatureState(feature, { hover: false });
    }
  });
}

function setFeatureStates(features, state, map) {
  features.forEach(feature => {
    if (feature.id !== undefined) {
      map.setFeatureState(feature, state);
    }
  });
}

function getQueryLayers(map, vectorLayers) {
  const existingLayers = [];
  for (const layer of vectorLayers) {
    const layerIds = [
      `sourdough_${layer}_polygons`,
      `sourdough_${layer}_lines`,
      `sourdough_${layer}_points`,
    ];
    for (const layerId of layerIds) {
      if (map.getLayer(layerId)) {
        existingLayers.push(layerId);
      }
    }
  }
  return existingLayers;
}

function queryFeatures(e, map, vectorLayers) {
  const tolerance = 5;
  const bbox = [
    [e.point.x - tolerance, e.point.y - tolerance],
    [e.point.x + tolerance, e.point.y + tolerance]
  ];
  return map.queryRenderedFeatures(bbox, { layers: getQueryLayers(map, vectorLayers) });
}

function displayFeatures(features, featureInfoPanel, vectorLayers, showCloseButton = false) {
  if (features.length === 0) {
    featureInfoPanel.style.display = "none";
    return;
  }

  featureInfoPanel.innerHTML = '';

  if (showCloseButton) {
    const closeButton = h('button', {
      id: 'close-feature-info',
      class: 'close',
      title: 'Close',
      'aria-label': 'Close'
    }, '×');
    featureInfoPanel.appendChild(closeButton);
  }

  for (let index = 0; index < features.length; index++) {
    const feature = features[index];
    const layerName = feature.sourceLayer;
    const rawId = feature.id;

    let osmElement;
    if (rawId != null) {
      // decode Planetiler ID (long) to OSM type + ID
      const osmType = [null, "node", "way", "relation"][rawId % 10];
      const osmId = Math.floor(rawId / 10);

      if (osmType != null) {
        osmElement = h('a', {
          href: `https://www.openstreetmap.org/${osmType}/${osmId}`,
          target: '_blank'
        }, `${osmType}/${osmId}`);
      } else {
        osmElement = h('span', `${rawId} (unknown type)`);
      }
    } else {
      osmElement = h('span', "No ID");
    }

    const layerIndex = vectorLayers.indexOf(layerName);
    const layerColor = layerIndex >= 0 ? colorForIdx(layerIndex) : "#ccc";

    if (index > 0) {
      featureInfoPanel.appendChild(h('hr'));
    }

    const layerHeader = h('div.layer-header',
      h('div.layer-swatch', {
        style: { backgroundColor: layerColor }
      }),
      h('strong', layerName)
    );
    featureInfoPanel.appendChild(layerHeader);

    const infoParagraph = h('p', osmElement, ' • ' + feature.geometry.type);
    featureInfoPanel.appendChild(infoParagraph);

    const table = h('table',
      Object.entries(feature.properties)
        .sort()
        .map(([key, value]) =>
          h('tr',
            h('td', key),
            h('td', ' = '),
            h('td', JSON.stringify(value))
          )
        )
    );
    featureInfoPanel.appendChild(table);
  }

  featureInfoPanel.style.display = "block";

  return showCloseButton;
}

export async function createViewer(container, tileJsonUrl, options = {}) {
  container.className = 'map-wrapper';
  
  const legendDiv = h('div.legend',
    h('h6', 'Layers'),
    h('ul', { id: 'legend-items' })
  );
  
  const mapDiv = h('div#map',
    h('div#feature-info.map-panel.feature-info')
  );
  
  container.appendChild(legendDiv);
  container.appendChild(mapDiv);

  // Fetch and parse TileJSON
  const tileJsonResponse = await fetch(tileJsonUrl);
  const tileJson = await tileJsonResponse.json();
  
  // Extract vector layers from TileJSON
  const vectorLayers = tileJson.vector_layers ? tileJson.vector_layers.map(layer => layer.id) : [];

  const map = new Map({
    container: mapDiv,
    style: {
      version: 8,
      glyphs: "https://tiles.openstreetmap.us/fonts/{fontstack}/{range}.pbf",
      sources: {},
      layers: [
        {
          id: "background",
          type: "background",
          paint: {
            "background-color": "#000b16",
          },
        },
      ],
    },
    attributionControl: false,
    ...options
  });

  // Add controls
  map.addControl(new NavigationControl(), "top-left");
  map.addControl(new ZoomControl(), "bottom-left");
  map.addControl(new AttributionControl({ compact: true }), "bottom-right");

  map.on("load", async () => {
    // Add TileJSON source
    map.addSource("sourdough", {
      type: "vector",
      url: tileJsonUrl,
    });

    // Create all map layers in a single pass, then add them in proper rendering order
    const layers = [];
    
    for (let i = 0; i < vectorLayers.length; i++) {
      const layerName = vectorLayers[i];
      const color = colorForIdx(i);

      layers.push({
        "id": `sourdough_${layerName}_polygons`,
        "type": "fill",
        "source": "sourdough",
        "source-layer": layerName,
        "filter": ["==", ["geometry-type"], "Polygon"],
        "paint": {
          "fill-color": color,
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.4, 0.15],
        },
      });

      layers.push({
        "id": `sourdough_${layerName}_lines`,
        "type": "line",
        "source": "sourdough",
        "source-layer": layerName,
        "filter": ["==", ["geometry-type"], "LineString"],
        "paint": {
          "line-color": color,
          "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2, 0.5],
        },
      });

      layers.push({
        "id": `sourdough_${layerName}_points`,
        "type": "circle",
        "source": "sourdough",
        "source-layer": layerName,
        "filter": ["==", ["geometry-type"], "Point"],
        "paint": {
          "circle-color": color,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.5, 12, 2.5],
          "circle-opacity": 0.8,
          "circle-stroke-color": "white",
          "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 3, 0],
        },
      });

      layers.push({
        "id": `sourdough_${layerName}_point_labels`,
        "type": "symbol",
        "source": "sourdough",
        "source-layer": layerName,
        "filter": ["all", ["==", ["geometry-type"], "Point"], ["has", "name"]],
        "layout": {
          "text-field": ["get", "name"],
          "text-font": TEXT_FONT,
          "text-size": TEXT_SIZE_POINT,
          "text-offset": [0, -0.5],
          "text-anchor": "bottom",
        },
        "paint": {
          "text-color": color,
          "text-halo-color": TEXT_HALO_COLOR,
          "text-halo-width": TEXT_HALO_WIDTH,
          "text-halo-blur": TEXT_HALO_BLUR,
        },
      });

      layers.push({
        "id": `sourdough_${layerName}_line_labels`,
        "type": "symbol",
        "source": "sourdough",
        "source-layer": layerName,
        "filter": ["all", ["==", ["geometry-type"], "LineString"], ["has", "name"]],
        "layout": {
          "text-field": ["get", "name"],
          "text-font": TEXT_FONT,
          "text-size": TEXT_SIZE_LINE,
          "symbol-placement": "line",
          "text-rotation-alignment": "map",
        },
        "paint": {
          "text-color": color,
          "text-halo-color": TEXT_HALO_COLOR,
          "text-halo-width": TEXT_HALO_WIDTH,
          "text-halo-blur": TEXT_HALO_BLUR,
        },
      });

      layers.push({
        "id": `sourdough_${layerName}_polygon_labels`,
        "type": "symbol",
        "source": "sourdough",
        "source-layer": layerName,
        "filter": ["all", ["==", ["geometry-type"], "Polygon"], ["has", "name"]],
        "layout": {
          "text-field": ["get", "name"],
          "text-font": TEXT_FONT,
          "text-size": TEXT_SIZE_POLYGON,
          "text-max-angle": 85,
          "text-offset": [0, 1],
          "text-rotation-alignment": "map",
          "text-keep-upright": true,
          "symbol-placement": "line",
          "symbol-spacing": 250,
        },
        "paint": {
          "text-color": color,
          "text-halo-color": TEXT_HALO_COLOR,
          "text-halo-width": TEXT_HALO_WIDTH,
          "text-halo-blur": TEXT_HALO_BLUR,
        },
      });
    }

    // Sort layers by type
    const order = ["fill", "line", "circle", "symbol"]
    layers.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    
    for (const layer of layers) {
      map.addLayer(layer);
    }

    // Create legend
    const legendItems = legendDiv.querySelector('#legend-items');

    const allItem = h('li',
      h('label',
        h('input', {
          type: 'checkbox',
          checked: true,
          id: 'legend-all',
          class: 'legend-all-checkbox'
        }),
        h('span.legend-all-text', 'All')
      )
    );
    legendItems.appendChild(allItem);
    
    const allCheckbox = allItem.querySelector('input');

    let lastClickedIndex = -1;
    const layerCheckboxes = [];

    for (let i = 0; i < vectorLayers.length; i++) {
      const layerName = vectorLayers[i];
      const color = colorForIdx(i);
      
      const legendItem = h('li',
        h('label',
          h('input', {
            type: 'checkbox',
            checked: true,
            class: 'legend-checkbox',
            'data-layer': layerName
          }),
          h('span', layerName)
        )
      );
      
      legendItems.appendChild(legendItem);
      const checkbox = legendItem.querySelector('input');
      checkbox.style.accentColor = color;
      layerCheckboxes.push(checkbox);

      let shiftPressed = false;

      const captureShift = (e) => { shiftPressed = e.shiftKey; };

      const label = legendItem.querySelector('label');
      checkbox.addEventListener("click", captureShift);
      label.addEventListener("click", captureShift);

      checkbox.addEventListener("change", (e) => {
        // Handle shift-click for range selection
        if (shiftPressed && lastClickedIndex >= 0) {
          const currentIndex = i;
          const start = Math.min(lastClickedIndex, currentIndex);
          const end = Math.max(lastClickedIndex, currentIndex);
          const newState = checkbox.checked;

          for (let j = start; j <= end; j++) {
            layerCheckboxes[j].checked = newState;
            toggleLayerVisibility(vectorLayers[j], newState);
          }
        } else {
          toggleLayerVisibility(layerName, checkbox.checked);
        }

        lastClickedIndex = i;
        shiftPressed = false;
        updateAllCheckboxState();
      });
    }

    function toggleLayerVisibility(layerName, visible) {
      for (const layerId of map.getLayersOrder()) {
        if (layerId.startsWith(`sourdough_${layerName}`)) {
          map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
        }
      }
    }

    function updateAllCheckboxState() {
      const checkedCount = layerCheckboxes.filter((cb) => cb.checked).length;
      const totalCount = layerCheckboxes.length;

      if (checkedCount === 0) {
        allCheckbox.checked = false;
        allCheckbox.indeterminate = false;
      } else if (checkedCount === totalCount) {
        allCheckbox.checked = true;
        allCheckbox.indeterminate = false;
      } else {
        allCheckbox.checked = false;
        allCheckbox.indeterminate = true;
      }
    }

    allCheckbox.addEventListener("change", () => {
      const newState = allCheckbox.checked;
      for (let i = 0; i < layerCheckboxes.length; i++) {
        layerCheckboxes[i].checked = newState;
        toggleLayerVisibility(vectorLayers[i], newState);
      }
      updateAllCheckboxState();
    });

    const featureInfoPanel = mapDiv.querySelector('#feature-info');
    setupHoverInteraction(map, featureInfoPanel, vectorLayers);
  });
}

function setupHoverInteraction(map, featureInfoPanel, vectorLayers) {
  let hoveredFeatures = [];
  let pinnedFeatures = [];
  let isPinned = false;

  function unpinFeatures() {
    if (isPinned) {
      clearFeatureStates(pinnedFeatures, map);
      pinnedFeatures = [];
      isPinned = false;
      featureInfoPanel.style.display = "none";
    }
  }

  function clearHoverStates() {
    clearFeatureStates(hoveredFeatures, map);
    hoveredFeatures = [];
    if (!isPinned) featureInfoPanel.style.display = "none";
    map.getCanvas().style.cursor = "";
  }

  map.on("mousemove", (e) => {
    if (isPinned) return;

    clearFeatureStates(hoveredFeatures, map);
    const features = queryFeatures(e, map, vectorLayers);

    if (features.length > 0) {
      const selectedFeatures = selectFeaturesByType(features);
      const featuresWithDistance = selectedFeatures
        .map(feature => ({ feature, distance: getDistanceToFeature(feature, e.lngLat) }))
        .sort((a, b) => a.distance - b.distance);

      hoveredFeatures = featuresWithDistance.map(item => item.feature);
      setFeatureStates(hoveredFeatures, { hover: true }, map);
      displayFeatures(hoveredFeatures, featureInfoPanel, vectorLayers);
      map.getCanvas().style.cursor = "pointer";
    } else {
      clearHoverStates();
    }
  });

  map.on("click", (e) => {
    if (isPinned) clearFeatureStates(pinnedFeatures, map);

    const features = queryFeatures(e, map, vectorLayers);
    if (features.length > 0) {
      const selectedFeatures = selectFeaturesByType(features);
      const featuresWithDistance = selectedFeatures
        .map(feature => ({ feature, distance: getDistanceToFeature(feature, e.lngLat) }))
        .sort((a, b) => a.distance - b.distance);

      pinnedFeatures = featuresWithDistance.map(item => item.feature);
      isPinned = true;

      clearFeatureStates(hoveredFeatures, map);
      setFeatureStates(pinnedFeatures, { hover: true }, map);
      displayFeatures(pinnedFeatures, featureInfoPanel, vectorLayers, true);
      
      const closeButton = document.getElementById("close-feature-info");
      if (closeButton) {
        closeButton.addEventListener("click", (e) => {
          e.stopPropagation();
          unpinFeatures();
        });
      }
    } else {
      unpinFeatures();
    }
  });

  map.getContainer().addEventListener("mouseout", () => {
    clearFeatureStates(hoveredFeatures, map);
    hoveredFeatures = [];
    
    if (!isPinned) {
      featureInfoPanel.style.display = "none";
    }
    
    map.getCanvas().style.cursor = "";
  });
}

