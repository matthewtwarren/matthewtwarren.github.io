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
// Free, keyless terrain DEM (Terrarium encoding) for hillshade + contours.
var DEM_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
var ATTRIBUTION = "Map data © OpenStreetMap contributors, © OpenMapTiles";

// Flat "poster" palette — warm paper with terracotta buildings, à la prettymapp.
var C = {
  paper: "#f2e8d2",
  water: "#a4c2d4",
  green: "#cbd6a6",
  park: "#b6cf96",
  building: "#c96a4f",
  buildingLine: "#b25b42",
  roadMajor: "#43403b",
  roadMinor: "#8a8175",
  contour: "#a9713f"
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

function lineWidth(base) {
  return ["interpolate", ["linear"], ["zoom"], 8, base * 0.5, 13, base, 16, base * 2];
}

function flatStyle(coordinates, accent) {
  var sources = {
    openmaptiles: { type: "vector", url: OFM_SOURCE },
    route: routeFeature(coordinates),
    dem: {
      type: "raster-dem", encoding: "terrarium",
      tiles: [DEM_TILES], tileSize: 256, maxzoom: 13
    }
  };

  var layers = [
    { id: "bg", type: "background", paint: { "background-color": C.paper } },
    { id: "landcover", type: "fill", source: "openmaptiles", "source-layer": "landcover",
      paint: { "fill-color": C.green, "fill-opacity": 0.55 } },
    { id: "landuse", type: "fill", source: "openmaptiles", "source-layer": "landuse",
      paint: { "fill-color": C.green, "fill-opacity": 0.4 } },
    { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park",
      paint: { "fill-color": C.park, "fill-opacity": 0.55 } },
    // Shaded relief over the vegetation for topographic depth.
    { id: "hillshade", type: "hillshade", source: "dem",
      paint: {
        "hillshade-exaggeration": 0.5,
        "hillshade-shadow-color": "#5a4c34",
        "hillshade-highlight-color": "#ffffff",
        "hillshade-accent-color": "#9c8a63"
      } },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water",
      paint: { "fill-color": C.water } },
    { id: "waterway", type: "line", source: "openmaptiles", "source-layer": "waterway",
      paint: { "line-color": C.water, "line-width": lineWidth(1.2) } }
  ];

  // Contour lines (best-effort — only if mlcontour set up).
  if (demSource) {
    sources.contours = {
      type: "vector",
      maxzoom: 15,
      tiles: [demSource.contourProtocolUrl({
        thresholds: { 10: [100, 500], 11: [100, 500], 12: [50, 250], 13: [25, 100], 14: [10, 50], 15: [10, 50] },
        contourLayer: "contours", elevationKey: "ele", levelKey: "level"
      })]
    };
    layers.push({
      id: "contours", type: "line", source: "contours", "source-layer": "contours",
      paint: {
        "line-color": C.contour,
        "line-opacity": 0.45,
        "line-width": ["match", ["get", "level"], 1, 1.3, 0.6]
      }
    });
  }

  layers.push(
    { id: "roads-minor", type: "line", source: "openmaptiles", "source-layer": "transportation",
      filter: ["!in", "class", "motorway", "trunk", "primary"],
      paint: { "line-color": C.roadMinor, "line-width": lineWidth(0.8) } },
    { id: "roads-major", type: "line", source: "openmaptiles", "source-layer": "transportation",
      filter: ["in", "class", "motorway", "trunk", "primary", "secondary"],
      paint: { "line-color": C.roadMajor, "line-width": lineWidth(1.6) } },
    { id: "building", type: "fill", source: "openmaptiles", "source-layer": "building",
      paint: { "fill-color": C.building, "fill-outline-color": C.buildingLine } },
    { id: "route-casing", type: "line", source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": lineWidth(5) } },
    { id: "route", type: "line", source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": accent, "line-width": lineWidth(3) } }
  );

  return { version: 8, sources: sources, layers: layers };
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
function drawProfile(ctx, elevation, x, y, w, h, font, labelPx) {
  var n = normalisedProfile(elevation);
  if (!n) return;
  var r = profileRange(elevation);
  var axisX = x + w - w * 0.14;   // y-axis on the right-hand side
  var chartX = x;
  var chartW = axisX - w * 0.02 - x;

  ctx.save();
  // min/max labels on the right (no axis line)
  ctx.fillStyle = "rgba(255,255,255,0.8)";
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
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

// Draw the profile + title + stats + discreet credit onto a canvas sized W×H.
function drawLabel(ctx, walk, W, H) {
  var font = siteFont();
  var grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
  grad.addColorStop(0, "rgba(20,18,16,0)");
  grad.addColorStop(1, "rgba(20,18,16,0.75)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, Math.round(H * 0.55), W, Math.round(H * 0.45));

  var padX = Math.round(W * 0.065);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 " + Math.round(W * 0.058) + "px " + font;
  ctx.fillText(walk.title || "", padX, Math.round(H * 0.83));

  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "500 " + Math.round(W * 0.032) + "px " + font;
  ctx.fillText(statsLine(walk), padX, Math.round(H * 0.875));

  if (walk.elevation) {
    drawProfile(ctx, walk.elevation, padX, Math.round(H * 0.895),
      W - 2 * padX, Math.round(H * 0.062), font, Math.round(W * 0.02));
  }

  // Discreet, licence-required credit.
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "400 " + Math.round(W * 0.016) + "px " + font;
  ctx.textAlign = "right";
  ctx.fillText("© OpenStreetMap · OpenMapTiles", W - padX, H - Math.round(H * 0.012));
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

// Render the poster at exactly 1080×1920 in an offscreen map, composite the
// label, and download a PNG.
function exportPoster(walk, onDone) {
  var W = 1080, H = 1920;
  var host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-99999px;top:0;width:" + W + "px;height:" + H + "px;";
  document.body.appendChild(host);

  var map = new maplibregl.Map({
    container: host,
    style: flatStyle(walk.coordinates, walk.accent),
    interactive: false,
    attributionControl: false,
    preserveDrawingBuffer: true,
    fadeDuration: 0
  });

  function cleanup() { map.remove(); host.remove(); }

  map.on("load", function () {
    map.fitBounds(boundsOf(walk.coordinates), { padding: padFor(W, H), animate: false });
    map.once("idle", function () {
      try {
        var canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(map.getCanvas(), 0, 0, W, H);
        drawLabel(ctx, walk, W, H);
        canvas.toBlob(function (blob) {
          if (blob) downloadBlob(blob, slugify(walk.title) + "-poster.png");
          cleanup();
          if (onDone) onDone();
        }, "image/png");
      } catch (e) {
        cleanup();
        if (onDone) onDone(e);
      }
    });
  });
  map.on("error", function () { /* keep going; tiles may still render */ });
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
    '  <div class="gpxposter__controls">' +
    '    <button type="button" class="gpxposter__btn" data-action="download">Download</button>' +
    '    <button type="button" class="gpxposter__btn" data-action="caption">Copy caption</button>' +
    '    <button type="button" class="gpxposter__btn gpxposter__btn--ghost" data-action="close">Close</button>' +
    '  </div>' +
    '</div>';
  document.body.appendChild(el);
  return el;
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

function openPoster(walk) {
  if (!walk || !walk.coordinates || walk.coordinates.length < 2) return;
  if (!modal) {
    modal = buildModal();
    modal.addEventListener("click", function (e) {
      var action = e.target.getAttribute("data-action");
      if (action === "close") closeModal();
      else if (action === "download") handleDownload(e.target);
      else if (action === "caption") handleCaption(e.target);
    });
  }

  modal._walk = walk;
  modal.querySelector(".gpxposter__title").textContent = walk.title || "";
  modal.querySelector(".gpxposter__stats").textContent = statsLine(walk);
  modal.querySelector(".gpxposter__profile").innerHTML = profileSvg(walk.elevation);
  modal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onKeydown);

  prepare().then(function () {
    if (modal._map) { modal._map.remove(); modal._map = null; }
    var mapEl = modal.querySelector(".gpxposter__map");
    var map = new maplibregl.Map({
      container: mapEl,
      style: flatStyle(walk.coordinates, walk.accent),
      interactive: false,
      attributionControl: false,
      fadeDuration: 0
    });
    modal._map = map;
    map.on("load", function () {
      var r = mapEl.getBoundingClientRect();
      map.fitBounds(boundsOf(walk.coordinates), {
        padding: padFor(r.width, r.height),
        animate: false
      });
      map.resize();
    });
  }).catch(function () {
    modal.querySelector(".gpxposter__map").textContent = "Could not load the map library.";
  });
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
