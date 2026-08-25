/*
 * gpxposter.js — a flat, prettymapp-style vector "poster" of a walk, in 9:16
 * portrait for Instagram. Rendered with MapLibre GL + OpenFreeMap (free, keyless
 * vector tiles) and a custom flat colour style. Lazy: MapLibre is only fetched
 * from the CDN the first time a poster is opened.
 *
 * Entry point: openPoster(walk), where walk = { coordinates:[[lng,lat]...],
 * title, chips:[[label,value]...], accent }. Stashed by gpxmap.js.
 */

var MAPLIBRE_JS = "https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.1/dist/maplibre-gl.js";
var MAPLIBRE_JS_SRI = "sha256-taNOaTD/k327ue7IiSz/uAukc8zoiuXKjEZUQy9fDrw=";
var MAPLIBRE_CSS = "https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.1/dist/maplibre-gl.css";
var MAPLIBRE_CSS_SRI = "sha256-eSrJl9z2rm9kPrTi3uRjDIXnBWUmvY+4X/6Dxn1sQbQ=";
var MLCONTOUR_JS = "https://cdn.jsdelivr.net/npm/maplibre-contour@0.1.0/dist/index.min.js";
var MLCONTOUR_JS_SRI = "sha256-5ViyMSWhTYX8/7e1xVa6u9e5nNtjNaKsX6AiHErlQ24=";

var OFM_SOURCE = "https://tiles.openfreemap.org/planet";
var OFM_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
// Free, keyless terrain DEM (Terrarium encoding) for hillshade + contours.
var DEM_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
var ATTRIBUTION = "Map data © OpenStreetMap contributors, © OpenMapTiles";

// Poster colour themes (single-word). Each defines the flat map palette, the
// hillshade tint, the contour colour, and the route colours.
var THEMES = {
  paper: {
    bg: "#f2e8d2", water: "#a4c2d4", green: "#cbd6a6", park: "#b6cf96",
    greenOpacity: 0.55, parkOpacity: 0.55,
    building: "#c96a4f", buildingLine: "#b25b42",
    roadMajor: "#43403b", roadMinor: "#8a8175",
    contour: "#a9713f", contourOpacity: 0.45,
    hillshade: { ex: 0.5, shadow: "#5a4c34", highlight: "#ffffff", accent: "#9c8a63" },
    route: "#002b8a", routeCasing: "#ffffff"
  },
  dark: {
    dark: true,
    bg: "#1b2330", water: "#26364a", green: "#2b3a33", park: "#33472f",
    greenOpacity: 0.6, parkOpacity: 0.6,
    building: "#46505f", buildingLine: "#2b3440",
    roadMajor: "#7f8a9c", roadMinor: "#454f5c",
    contour: "#5b6a7c", contourOpacity: 0.4,
    hillshade: { ex: 0.55, shadow: "#0d1219", highlight: "#3c4a5e", accent: "#263041" },
    route: "#f2b53c", routeCasing: "#11161f"
  },
  vivid: {
    bg: "#eef3e2", water: "#4a9fd6", green: "#8cc35f", park: "#6cbf52",
    greenOpacity: 0.78, parkOpacity: 0.78,
    building: "#ec5f36", buildingLine: "#c9421f",
    roadMajor: "#35332f", roadMinor: "#7a756c",
    contour: "#b3641f", contourOpacity: 0.55,
    hillshade: { ex: 0.75, shadow: "#4a3a24", highlight: "#ffffff", accent: "#a07b45" },
    route: "#0f3aa0", routeCasing: "#ffffff"
  },
  // Topography-first: strong shaded relief, bold + dense contours, muted
  // natural landcover and understated roads/buildings so terrain reads first.
  relief: {
    bg: "#ece5d6", water: "#9dbfce", green: "#bcc9a3", park: "#aac088",
    greenOpacity: 0.42, parkOpacity: 0.45,
    building: "#bfa98e", buildingLine: "#a58f72",
    roadMajor: "#6a6255", roadMinor: "#9d9482",
    contour: "#7d5a34", contourOpacity: 0.7, contourWidth: 1.4,
    contourThresholds: { 10: [100, 500], 11: [50, 250], 12: [25, 100], 13: [10, 50], 14: [10, 50], 15: [10, 50] },
    hillshade: { ex: 0.95, shadow: "#463724", highlight: "#fffaf0", accent: "#8a7048" },
    route: "#bd3b2f", routeCasing: "#ffffff"
  },
  // Dark counterpart to Relief: shaded relief and bold contours on dark slate.
  slate: {
    dark: true,
    bg: "#20262e", water: "#2b3947", green: "#2c352f", park: "#31402f",
    greenOpacity: 0.4, parkOpacity: 0.45,
    building: "#3c444d", buildingLine: "#2a3038",
    roadMajor: "#7a828d", roadMinor: "#454c55",
    contour: "#8a9aa6", contourOpacity: 0.5, contourWidth: 1.4,
    contourThresholds: { 10: [100, 500], 11: [50, 250], 12: [25, 100], 13: [10, 50], 14: [10, 50], 15: [10, 50] },
    hillshade: { ex: 1.0, shadow: "#0d1217", highlight: "#586773", accent: "#333d48" },
    route: "#f0a93a", routeCasing: "#141a20"
  },
  // OpenTopoMap / Ordnance-Survey feel, like the topo card: near-white warm
  // base, fine light-orange contours + soft relief, green only on woodland,
  // a bright stream network, orange A-roads and an accent-blue route.
  classic: {
    bg: "#faf7f0",
    water: "#b3cfe0", waterLine: "#6f9fce",
    green: "#cfe0af", park: "#c1d99c",
    greenOpacity: 0.7, parkOpacity: 0.6, woodOnly: true,
    building: "#e6d3b0", buildingLine: "#cdb488",
    roadMajor: "#e79640", roadMinor: "#d8c39c",
    contour: "#d29a63", contourOpacity: 0.6, contourWidth: 0.75,
    contourThresholds: { 10: [100, 500], 11: [50, 250], 12: [20, 100], 13: [10, 50], 14: [10, 50], 15: [10, 50] },
    hillshade: { ex: 0.4, shadow: "#9a897b", highlight: "#ffffff", accent: "#b7a48f" },
    route: "#002b8a", routeCasing: "#ffffff"
  }
};

var ROUTE_WIDTHS = { thin: 0.7, medium: 1, thick: 1.4 };
var FONT_SCALES = { small: 0.85, medium: 1, large: 1.2 };

var SETTINGS = { theme: "paper", route: "medium", font: "medium", labels: "on" };
var SETTINGS_KEY = "gpxposter:settings";

(function loadSettings() {
  try {
    var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (THEMES[s.theme]) SETTINGS.theme = s.theme;
    if (ROUTE_WIDTHS[s.route]) SETTINGS.route = s.route;
    if (FONT_SCALES[s.font]) SETTINGS.font = s.font;
    if (s.labels === "on" || s.labels === "off") SETTINGS.labels = s.labels;
  } catch (e) { /* keep defaults */ }
})();

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) { /* ignore */ }
}

function theme() { return THEMES[SETTINGS.theme]; }

// Output formats. reel = 9:16 with the caption overlaid on the map; poster =
// square map centred on the route with the caption on a strip below, at print
// resolution. mapScale renders the map smaller with a matching pixelRatio so
// map labels/contours/route are a legible size in the exported image.
var FORMATS = {
  reel: { cls: "gpxposter--reel", w: 1080, h: 1920, mapScale: 2.5 },
  poster: { cls: "gpxposter--poster", side: 2000, capFrac: 0.26, mapScale: 2 }
};

function loadScript(src, sri, css) {
  return new Promise(function (resolve, reject) {
    if (css) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = css;
      link.integrity = MAPLIBRE_CSS_SRI;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
    var s = document.createElement("script");
    s.src = src;
    s.integrity = sri;
    s.crossOrigin = "anonymous";
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error("Could not load " + src)); };
    document.head.appendChild(s);
  });
}

var preparePromise = null;
var demSource = null; // mlcontour DemSource, once ready

// Load MapLibre (required) then mlcontour (best-effort). Sets up the shared DEM
// source used for contour generation. Resolves even if contours are unavailable.
function prepare() {
  if (preparePromise) return preparePromise;
  preparePromise = (window.maplibregl
    ? Promise.resolve()
    : loadScript(MAPLIBRE_JS, MAPLIBRE_JS_SRI, MAPLIBRE_CSS)
  ).then(function () {
    return loadScript(MLCONTOUR_JS, MLCONTOUR_JS_SRI).then(function () {
      try {
        demSource = new mlcontour.DemSource({
          url: DEM_TILES, encoding: "terrarium", maxzoom: 13, worker: true
        });
        demSource.setupMaplibre(maplibregl);
      } catch (e) { demSource = null; }
    }, function () { demSource = null; /* contours optional */ });
  });
  return preparePromise;
}

/* -- Style + geometry --------------------------------------------------- */

function routeFeature(coordinates) {
  return {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: { type: "LineString", coordinates: coordinates }
    }
  };
}

function boundsOf(coordinates) {
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  coordinates.forEach(function (c) {
    if (c[0] < minX) minX = c[0];
    if (c[0] > maxX) maxX = c[0];
    if (c[1] < minY) minY = c[1];
    if (c[1] > maxY) maxY = c[1];
  });
  return [[minX, minY], [maxX, maxY]];
}

// Same fractional padding at any size, so the on-screen frame and the 1080×1920
// export frame the route identically. Extra room at the bottom for the label.
function padFor(w, h) {
  return {
    top: Math.round(h * 0.07),
    right: Math.round(w * 0.08),
    left: Math.round(w * 0.08),
    bottom: Math.round(h * 0.3)
  };
}

// Centre the route in the square, biased upward to leave room for the
// translucent caption band across the bottom.
function padPoster(w, h) {
  return {
    top: Math.round(h * 0.07),
    right: Math.round(w * 0.08),
    left: Math.round(w * 0.08),
    bottom: Math.round(h * 0.29)
  };
}

function lineWidth(base) {
  return ["interpolate", ["linear"], ["zoom"], 8, base * 0.5, 13, base, 16, base * 2];
}

function flatStyle(coordinates) {
  var t = theme();
  var rw = ROUTE_WIDTHS[SETTINGS.route] || 1;

  var sources = {
    openmaptiles: { type: "vector", url: OFM_SOURCE },
    route: routeFeature(coordinates),
    dem: {
      type: "raster-dem", encoding: "terrarium",
      tiles: [DEM_TILES], tileSize: 256, maxzoom: 13
    }
  };

  var layers = [
    { id: "bg", type: "background", paint: { "background-color": t.bg } },
    { id: "landcover", type: "fill", source: "openmaptiles", "source-layer": "landcover",
      // woodOnly themes (Classic) green just the woods, leaving open land light.
      filter: t.woodOnly ? ["==", "class", "wood"] : ["has", "class"],
      paint: { "fill-color": t.green, "fill-opacity": t.greenOpacity } },
    { id: "landuse", type: "fill", source: "openmaptiles", "source-layer": "landuse",
      paint: { "fill-color": t.green, "fill-opacity": t.woodOnly ? 0 : t.greenOpacity * 0.72 } },
    { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park",
      paint: { "fill-color": t.park, "fill-opacity": t.parkOpacity } },
    // Shaded relief over the vegetation for topographic depth.
    { id: "hillshade", type: "hillshade", source: "dem",
      paint: {
        "hillshade-exaggeration": t.hillshade.ex,
        "hillshade-shadow-color": t.hillshade.shadow,
        "hillshade-highlight-color": t.hillshade.highlight,
        "hillshade-accent-color": t.hillshade.accent
      } },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water",
      paint: { "fill-color": t.water } },
    { id: "waterway", type: "line", source: "openmaptiles", "source-layer": "waterway",
      paint: { "line-color": t.waterLine || t.water, "line-width": lineWidth(1) } }
  ];

  // Contour lines (best-effort — only if mlcontour set up).
  if (demSource) {
    sources.contours = {
      type: "vector",
      maxzoom: 15,
      tiles: [demSource.contourProtocolUrl({
        thresholds: t.contourThresholds ||
          { 10: [100, 500], 11: [100, 500], 12: [50, 250], 13: [25, 100], 14: [10, 50], 15: [10, 50] },
        contourLayer: "contours", elevationKey: "ele", levelKey: "level"
      })]
    };
    var cw = t.contourWidth || 1;
    layers.push({
      id: "contours", type: "line", source: "contours", "source-layer": "contours",
      paint: {
        "line-color": t.contour,
        "line-opacity": t.contourOpacity,
        "line-width": ["match", ["get", "level"], 1, 1.3 * cw, 0.6 * cw]
      }
    });
  }

  layers.push(
    { id: "roads-minor", type: "line", source: "openmaptiles", "source-layer": "transportation",
      filter: ["!in", "class", "motorway", "trunk", "primary"],
      paint: { "line-color": t.roadMinor, "line-width": lineWidth(0.8) } },
    { id: "roads-major", type: "line", source: "openmaptiles", "source-layer": "transportation",
      filter: ["in", "class", "motorway", "trunk", "primary", "secondary"],
      paint: { "line-color": t.roadMajor, "line-width": lineWidth(1.6) } },
    { id: "building", type: "fill", source: "openmaptiles", "source-layer": "building",
      paint: { "fill-color": t.building, "fill-outline-color": t.buildingLine } },
    { id: "route-casing", type: "line", source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": t.routeCasing, "line-width": lineWidth(5 * rw) } },
    { id: "route", type: "line", source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": t.route, "line-width": lineWidth(3 * rw) } }
  );

  // Small geographic labels — peaks (with elevation), water bodies, settlements.
  if (SETTINGS.labels === "on") {
    var labelColor = t.dark ? "#dbe1e8" : "#48402f";
    var halo = t.bg;
    var name = ["coalesce", ["get", "name:en"], ["get", "name"]];
    layers.push(
      { id: "label-place", type: "symbol", source: "openmaptiles", "source-layer": "place",
        minzoom: 9,
        filter: ["in", "class", "town", "village", "hamlet", "suburb", "locality"],
        layout: { "text-field": name, "text-font": ["Noto Sans Regular"],
          "text-size": 10.5, "text-max-width": 7, "text-padding": 3 },
        paint: { "text-color": labelColor, "text-halo-color": halo, "text-halo-width": 1.2 } },
      { id: "label-water", type: "symbol", source: "openmaptiles", "source-layer": "water_name",
        minzoom: 10,
        layout: { "text-field": name, "text-font": ["Noto Sans Italic"],
          "text-size": 9.5, "text-max-width": 6 },
        paint: { "text-color": labelColor, "text-halo-color": halo, "text-halo-width": 1.1 } },
      { id: "label-peak", type: "symbol", source: "openmaptiles", "source-layer": "mountain_peak",
        minzoom: 10,
        filter: ["all", ["in", "class", "peak", "volcano"], ["has", "name"]],
        layout: {
          "text-field": ["case", ["has", "ele"],
            ["concat", ["get", "name"], "\n", ["to-string", ["get", "ele"]], " m"],
            ["get", "name"]],
          "text-font": ["Noto Sans Bold"], "text-size": 10, "text-max-width": 6,
          "text-anchor": "top", "text-offset": [0, 0.35], "text-padding": 3
        },
        paint: { "text-color": labelColor, "text-halo-color": halo, "text-halo-width": 1.1 } }
    );
  }

  return { version: 8, glyphs: OFM_GLYPHS, sources: sources, layers: layers };
}

/* -- Label drawing (canvas, for export) --------------------------------- */

function siteFont() {
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

function statsLine(walk) {
  return walk.chips.map(function (c) { return c[1]; }).join("   ·   ");
}

// Elevation series → points normalised to x:0..1 (left→right), y:0..1 (low→high).
function normalisedProfile(elevation) {
  if (!elevation || elevation.length < 2) return null;
  var dMin = elevation[0][0], dMax = elevation[elevation.length - 1][0];
  var eMin = Infinity, eMax = -Infinity;
  elevation.forEach(function (p) { if (p[1] < eMin) eMin = p[1]; if (p[1] > eMax) eMax = p[1]; });
  var dR = (dMax - dMin) || 1, eR = (eMax - eMin) || 1;
  return elevation.map(function (p) { return [(p[0] - dMin) / dR, (p[1] - eMin) / eR]; });
}

function profileRange(elevation) {
  var eMin = Infinity, eMax = -Infinity;
  elevation.forEach(function (p) { if (p[1] < eMin) eMin = p[1]; if (p[1] > eMax) eMax = p[1]; });
  return { min: Math.round(eMin), max: Math.round(eMax) };
}

// Line-only profile (no fill) with a min/max y-axis, for the on-screen overlay.
function profileSvg(elevation) {
  var n = normalisedProfile(elevation);
  if (!n) return "";
  var r = profileRange(elevation);
  var W = 100, H = 30, pad = 2;
  var pts = n.map(function (p) {
    return (p[0] * W).toFixed(2) + "," + (H - pad - p[1] * (H - 2 * pad)).toFixed(2);
  });
  return '<div class="gpxposter__profile-chart">' +
    '<svg class="gpxposter__profile-svg" viewBox="0 0 ' + W + ' ' + H + '" ' +
    'preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts.join(" ") + '" /></svg>' +
    '</div>' +
    '<div class="gpxposter__profile-axis">' +
    '<span>' + r.max + ' m</span><span>' + r.min + ' m</span></div>';
}

// Line-only profile with a min/max y-axis, drawn into rect (x,y,w,h) on canvas.
function drawProfile(ctx, elevation, x, y, w, h, font, labelPx, color) {
  var n = normalisedProfile(elevation);
  if (!n) return;
  var lineCol = color || "rgba(255,255,255,0.92)";
  var labelCol = color || "rgba(255,255,255,0.8)";
  var r = profileRange(elevation);
  var axisX = x + w - w * 0.14;   // labels on the right-hand side
  var chartX = x;
  var chartW = axisX - w * 0.02 - x;

  ctx.save();
  // min/max labels on the right (no axis line)
  ctx.fillStyle = labelCol;
  ctx.font = "500 " + labelPx + "px " + font;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(r.max + " m", axisX + w * 0.02, y);
  ctx.textBaseline = "bottom";
  ctx.fillText(r.min + " m", axisX + w * 0.02, y + h);
  ctx.textBaseline = "alphabetic";

  // the profile line
  ctx.beginPath();
  n.forEach(function (p, i) {
    var px = chartX + p[0] * chartW, py = y + (1 - p[1]) * h;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.lineWidth = Math.max(3, Math.round(w * 0.006));
  ctx.strokeStyle = lineCol;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

// Greedy word-wrap to fit maxWidth (ctx.font must be set before calling).
function wrapText(ctx, text, maxWidth) {
  var words = (text || "").split(/\s+/).filter(Boolean);
  var lines = [], line = "";
  words.forEach(function (word) {
    var test = line ? line + " " + word : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

// Reel caption: title + stats + profile + credit overlaid on a bottom scrim,
// bottom-anchored and growing upward so wrapped titles never clip.
function drawReelCaption(ctx, walk, W, H) {
  var font = siteFont();
  var fs = FONT_SCALES[SETTINGS.font] || 1;
  var padX = Math.round(W * 0.065);
  var maxW = W - 2 * padX;

  var grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
  grad.addColorStop(0, "rgba(20,18,16,0)");
  grad.addColorStop(1, "rgba(20,18,16,0.8)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, Math.round(H * 0.5), W, Math.round(H * 0.5));

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  var titlePx = Math.round(W * 0.058 * fs);
  ctx.font = "700 " + titlePx + "px " + font;
  var titleLines = wrapText(ctx, walk.title || "", maxW);
  var titleLH = Math.round(titlePx * 1.16);

  var statsPx = Math.round(W * 0.032 * fs);
  ctx.font = "500 " + statsPx + "px " + font;
  var statsLines = wrapText(ctx, statsLine(walk), maxW);
  var statsLH = Math.round(statsPx * 1.3);

  var profileH = walk.elevation ? Math.round(H * 0.062) : 0;
  var gap1 = Math.round(H * 0.006);
  var gap2 = Math.round(H * 0.02);

  var totalH = titleLines.length * titleLH + gap1 + statsLines.length * statsLH +
    (profileH ? gap2 + profileH : 0);
  var y = Math.round(H * 0.955) - totalH;

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 " + titlePx + "px " + font;
  titleLines.forEach(function (ln) { y += titleLH; ctx.fillText(ln, padX, y); });

  y += gap1;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "500 " + statsPx + "px " + font;
  statsLines.forEach(function (ln) { y += statsLH; ctx.fillText(ln, padX, y); });

  if (profileH) {
    y += gap2;
    drawProfile(ctx, walk.elevation, padX, y, maxW, profileH, font, Math.round(W * 0.02 * fs));
  }

  // Discreet, licence-required credit.
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "400 " + Math.round(W * 0.016) + "px " + font;
  ctx.textAlign = "right";
  ctx.fillText("© OpenStreetMap · OpenMapTiles", W - padX, H - Math.round(H * 0.014));
  ctx.textAlign = "left";
}

// Poster caption: title + stats + profile on the strip below the square map,
// in the theme's ink (dark on light themes, light on dark). Top-anchored.
function drawPosterCaption(ctx, walk, W, stripY, capH) {
  var t = theme();
  var ink = t.dark ? "#e9edf2" : "#2b2620";
  var font = siteFont();
  var fs = FONT_SCALES[SETTINGS.font] || 1;
  var padX = Math.round(W * 0.06);
  var maxW = W - 2 * padX;
  var y = stripY + Math.round(capH * 0.02);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  var titlePx = Math.round(W * 0.045 * fs);
  ctx.font = "700 " + titlePx + "px " + font;
  var titleLines = wrapText(ctx, walk.title || "", maxW);
  var titleLH = Math.round(titlePx * 1.18);
  ctx.fillStyle = ink;
  titleLines.forEach(function (ln) { y += titleLH; ctx.fillText(ln, padX, y); });

  y += Math.round(capH * 0.03);
  var statsPx = Math.round(W * 0.026 * fs);
  ctx.font = "500 " + statsPx + "px " + font;
  var statsLines = wrapText(ctx, statsLine(walk), maxW);
  var statsLH = Math.round(statsPx * 1.32);
  ctx.fillStyle = ink;
  statsLines.forEach(function (ln) { y += statsLH; ctx.fillText(ln, padX, y); });

  if (walk.elevation) {
    y += Math.round(capH * 0.05);
    var profH = Math.min(Math.round(capH * 0.3), stripY + capH - y - Math.round(capH * 0.08));
    if (profH > 20) {
      drawProfile(ctx, walk.elevation, padX, y, maxW, profH, font, Math.round(W * 0.018 * fs), ink);
    }
  }

  // Discreet, licence-required credit, bottom-right of the strip.
  ctx.fillStyle = "rgba(" + (t.dark ? "233,237,242" : "43,38,32") + ",0.5)";
  ctx.font = "400 " + Math.round(W * 0.013) + "px " + font;
  ctx.textAlign = "right";
  ctx.fillText("© OpenStreetMap · OpenMapTiles", W - padX, stripY + capH - Math.round(capH * 0.06));
  ctx.textAlign = "left";
}

/* -- Export ------------------------------------------------------------- */

function slugify(s) {
  return (s || "walk").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "walk";
}

function downloadBlob(blob, name) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

// Render the map offscreen at logical size lw×lh with pixelRatio `scale` (so
// map labels/contours/route stay legible), fit the route, and hand the rendered
// map canvas to `compose` once idle.
function renderOffscreen(walk, lw, lh, scale, padFn, compose) {
  var host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-99999px;top:0;width:" + lw + "px;height:" + lh + "px;";
  document.body.appendChild(host);
  var map = new maplibregl.Map({
    container: host,
    style: flatStyle(walk.coordinates),
    interactive: false,
    attributionControl: false,
    preserveDrawingBuffer: true,
    fadeDuration: 0,
    pixelRatio: scale
  });
  function cleanup() { map.remove(); host.remove(); }
  map.on("load", function () {
    map.fitBounds(boundsOf(walk.coordinates), { padding: padFn(lw, lh), animate: false });
    map.once("idle", function () {
      try { compose(map.getCanvas()); } finally { cleanup(); }
    });
  });
  map.on("error", function () { /* keep going; tiles may still render */ });
}

function finishExport(canvas, name, onDone) {
  canvas.toBlob(function (blob) {
    if (blob) downloadBlob(blob, name);
    if (onDone) onDone();
  }, "image/png");
}

// Export the current format: reel (9:16, overlaid caption) or poster (square
// map centred on the route with a caption strip below, at print resolution).
function exportPoster(walk, onDone) {
  var fmt = FORMATS[modal._format] || FORMATS.reel;
  if (modal._format === "poster") {
    var S = fmt.side, cap = Math.round(S * fmt.capFrac);
    renderOffscreen(walk, S / fmt.mapScale, S / fmt.mapScale, fmt.mapScale, padPoster, function (mapCanvas) {
      var c = document.createElement("canvas");
      c.width = S; c.height = S; // square
      var ctx = c.getContext("2d");
      ctx.drawImage(mapCanvas, 0, 0, S, S); // full-bleed square map
      // translucent caption band across the bottom, showing the map beneath
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = theme().bg;
      ctx.fillRect(0, S - cap, S, cap);
      ctx.restore();
      drawPosterCaption(ctx, walk, S, S - cap, cap);
      finishExport(c, slugify(walk.title) + "-print.png", onDone);
    });
  } else {
    var rw = fmt.w, rh = fmt.h;
    renderOffscreen(walk, rw / fmt.mapScale, rh / fmt.mapScale, fmt.mapScale, padFor, function (mapCanvas) {
      var c = document.createElement("canvas");
      c.width = rw; c.height = rh;
      var ctx = c.getContext("2d");
      ctx.drawImage(mapCanvas, 0, 0, rw, rh);
      drawReelCaption(ctx, walk, rw, rh);
      finishExport(c, slugify(walk.title) + "-poster.png", onDone);
    });
  }
}

/* -- Modal + display ---------------------------------------------------- */

var modal = null;

function buildModal() {
  var el = document.createElement("div");
  el.className = "gpxposter";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Shareable poster");
  el.innerHTML =
    '<div class="gpxposter__backdrop" data-action="close"></div>' +
    '<div class="gpxposter__dialog">' +
    '  <div class="gpxposter__frame">' +
    '    <div class="gpxposter__map"></div>' +
    '    <div class="gpxposter__label">' +
    '      <div class="gpxposter__title"></div>' +
    '      <div class="gpxposter__stats"></div>' +
    '      <div class="gpxposter__profile"></div>' +
    '    </div>' +
    '    <div class="gpxposter__credit">© OpenStreetMap · OpenMapTiles</div>' +
    '  </div>' +
    '  <div class="gpxposter__settings" hidden>' +
    settingRow("Theme", "theme", [["paper", "Paper"], ["classic", "Classic"], ["dark", "Dark"], ["vivid", "Vivid"], ["relief", "Relief"], ["slate", "Slate"]]) +
    settingRow("Line", "route", [["thin", "Thin"], ["medium", "Medium"], ["thick", "Thick"]]) +
    settingRow("Font", "font", [["small", "S"], ["medium", "M"], ["large", "L"]]) +
    settingRow("Labels", "labels", [["on", "On"], ["off", "Off"]]) +
    '  </div>' +
    '  <div class="gpxposter__controls">' +
    '    <button type="button" class="gpxposter__btn gpxposter__btn--ghost" data-action="settings">Style</button>' +
    '    <button type="button" class="gpxposter__btn" data-action="download">Download</button>' +
    '    <button type="button" class="gpxposter__btn" data-action="caption">Copy caption</button>' +
    '    <button type="button" class="gpxposter__btn gpxposter__btn--ghost" data-action="close">Close</button>' +
    '  </div>' +
    '</div>';
  document.body.appendChild(el);
  return el;
}

function settingRow(label, setting, options) {
  var btns = options.map(function (o) {
    return '<button type="button" class="gpxposter__seg-btn" data-setting="' + setting +
      '" data-value="' + o[0] + '">' + o[1] + '</button>';
  }).join("");
  return '<div class="gpxposter__setrow">' +
    '<span class="gpxposter__setlabel">' + label + '</span>' +
    '<div class="gpxposter__seg">' + btns + '</div></div>';
}

function closeModal() {
  if (!modal) return;
  if (modal._map) { modal._map.remove(); modal._map = null; }
  modal.classList.remove("is-open");
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onKeydown);
}

function onKeydown(e) {
  if (e.key === "Escape") closeModal();
}

// (Re)create the display map from the current theme/route settings.
function renderDisplayMap(walk) {
  prepare().then(function () {
    if (modal._map) { modal._map.remove(); modal._map = null; }
    var mapEl = modal.querySelector(".gpxposter__map");
    mapEl.textContent = "";
    var map = new maplibregl.Map({
      container: mapEl,
      style: flatStyle(walk.coordinates),
      interactive: false,
      attributionControl: false,
      fadeDuration: 0
    });
    modal._map = map;
    map.on("load", function () {
      var r = mapEl.getBoundingClientRect();
      var padFn = modal._format === "poster" ? padPoster : padFor;
      map.fitBounds(boundsOf(walk.coordinates), {
        padding: padFn(r.width, r.height),
        animate: false
      });
      map.resize();
    });
  }).catch(function () {
    modal.querySelector(".gpxposter__map").textContent = "Could not load the map library.";
  });
}

function applyFont() {
  modal.querySelector(".gpxposter__frame").style
    .setProperty("--gpxposter-font-scale", FONT_SCALES[SETTINGS.font] || 1);
}

// Set the caption ink + poster strip colours from the format and theme.
function applyInk() {
  var frame = modal.querySelector(".gpxposter__frame");
  var t = theme();
  if (modal._format === "poster") {
    frame.style.setProperty("--gpxposter-ink", t.dark ? "#e9edf2" : "#2b2620");
    frame.style.setProperty("--gpxposter-strip-bg", t.bg);
  } else {
    frame.style.setProperty("--gpxposter-ink", "#ffffff");
    frame.style.removeProperty("--gpxposter-strip-bg");
  }
}

function markActiveSegs() {
  var btns = modal.querySelectorAll(".gpxposter__seg-btn");
  Array.prototype.forEach.call(btns, function (b) {
    var on = SETTINGS[b.getAttribute("data-setting")] === b.getAttribute("data-value");
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function changeSetting(setting, value) {
  if (SETTINGS[setting] === value) return;
  SETTINGS[setting] = value;
  saveSettings();
  markActiveSegs();
  if (setting === "font") applyFont();
  else {
    if (setting === "theme") applyInk(); // strip colours follow the theme
    if (modal._walk) renderDisplayMap(modal._walk);
  }
}

function onModalClick(e) {
  var seg = e.target.closest && e.target.closest(".gpxposter__seg-btn");
  if (seg) { changeSetting(seg.getAttribute("data-setting"), seg.getAttribute("data-value")); return; }
  var action = e.target.getAttribute("data-action");
  if (action === "close") closeModal();
  else if (action === "download") handleDownload(e.target);
  else if (action === "caption") handleCaption(e.target);
  else if (action === "settings") {
    var panel = modal.querySelector(".gpxposter__settings");
    panel.hidden = !panel.hidden;
    e.target.classList.toggle("is-active", !panel.hidden);
  }
}

function openPoster(walk, format) {
  if (!walk || !walk.coordinates || walk.coordinates.length < 2) return;
  format = FORMATS[format] ? format : "reel";
  if (!modal) {
    modal = buildModal();
    modal.addEventListener("click", onModalClick);
  }

  modal._walk = walk;
  modal._format = format;
  modal.classList.remove("gpxposter--reel", "gpxposter--poster");
  modal.classList.add(FORMATS[format].cls);
  modal.querySelector(".gpxposter__title").textContent = walk.title || "";
  modal.querySelector(".gpxposter__stats").textContent = statsLine(walk);
  modal.querySelector(".gpxposter__profile").innerHTML = profileSvg(walk.elevation);
  markActiveSegs();
  applyFont();
  applyInk();
  modal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onKeydown);

  renderDisplayMap(walk);
}

function handleDownload(btn) {
  if (!modal._walk) return;
  var label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Rendering…";
  exportPoster(modal._walk, function () {
    btn.disabled = false;
    btn.textContent = label;
  });
}

function handleCaption(btn) {
  if (!modal._walk) return;
  var walk = modal._walk;
  var text = walk.title + "\n" + statsLine(walk) + "\n\n" + ATTRIBUTION;
  var done = function () {
    var label = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(function () { btn.textContent = label; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, done);
  } else {
    done();
  }
}

export { openPoster };
