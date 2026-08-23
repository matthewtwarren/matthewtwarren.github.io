/*
 * gpxmap.js — render a GPX track on an OpenTopoMap Leaflet map with computed
 * stats and an optional elevation profile. Dependency-free: parsing is done
 * with the browser's DOMParser, Leaflet is loaded separately from a CDN.
 *
 * Public entry point: renderRoute(figureEl, gpxText) — kept separate from the
 * fetch/auto-init logic so a future upload tool can reuse the same engine.
 */

var ELEVATION_THRESHOLD = 3; // metres; smooths GPS noise out of ascent totals

/* -- Parsing ------------------------------------------------------------- */

function parseGpx(text) {
  var doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Could not parse GPX file");
  }

  var trkpts = doc.getElementsByTagName("trkpt");
  var points = [];
  for (var i = 0; i < trkpts.length; i++) {
    var pt = trkpts[i];
    var lat = parseFloat(pt.getAttribute("lat"));
    var lon = parseFloat(pt.getAttribute("lon"));
    if (isNaN(lat) || isNaN(lon)) continue;

    var eleEl = pt.getElementsByTagName("ele")[0];
    var timeEl = pt.getElementsByTagName("time")[0];
    points.push({
      lat: lat,
      lon: lon,
      ele: eleEl ? parseFloat(eleEl.textContent) : null,
      time: timeEl ? new Date(timeEl.textContent) : null
    });
  }

  var nameEl = doc.querySelector("trk > name") || doc.querySelector("metadata > name");
  return {
    points: points,
    name: nameEl ? nameEl.textContent.trim() : ""
  };
}

/* -- Metrics ------------------------------------------------------------- */

function haversine(a, b) {
  var R = 6371000; // metres
  var toRad = Math.PI / 180;
  var dLat = (b.lat - a.lat) * toRad;
  var dLon = (b.lon - a.lon) * toRad;
  var lat1 = a.lat * toRad;
  var lat2 = b.lat * toRad;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function computeStats(points) {
  var distance = 0;      // metres
  var cumulative = [0];  // metres, per point
  for (var i = 1; i < points.length; i++) {
    distance += haversine(points[i - 1], points[i]);
    cumulative.push(distance);
  }

  var eles = points.map(function (p) { return p.ele; }).filter(function (e) {
    return e !== null && !isNaN(e);
  });
  var hasEle = eles.length === points.length && eles.length > 1;

  var ascent = 0;
  if (hasEle) {
    var ref = eles[0];
    for (var j = 1; j < eles.length; j++) {
      var e = eles[j];
      if (e - ref > ELEVATION_THRESHOLD) {
        ascent += e - ref;
        ref = e;
      } else if (e < ref) {
        ref = e;
      }
    }
  }

  var times = points.map(function (p) { return p.time; }).filter(function (t) {
    return t && !isNaN(t.getTime());
  });
  var hasTime = times.length > 1;
  var durationMs = hasTime ? times[times.length - 1] - times[0] : null;

  return {
    distanceKm: distance / 1000,
    cumulative: cumulative,
    ascent: ascent,
    hasEle: hasEle,
    hasTime: hasTime,
    durationMs: durationMs,
    startTime: hasTime ? times[0] : null
  };
}

/* -- Formatting ---------------------------------------------------------- */

function formatDistance(km) {
  return km.toFixed(km < 10 ? 2 : 1) + " km";
}

function formatDuration(ms) {
  var totalMinutes = Math.round(ms / 60000);
  var hours = Math.floor(totalMinutes / 60);
  var minutes = totalMinutes % 60;
  return hours > 0 ? hours + "h " + minutes + "m" : minutes + "m";
}

function formatDate(date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

// Derive a { date, title } fallback from a filename like
// "2026-08-24-kinder-scout.gpx".
function fromFilename(name) {
  var base = name.replace(/\.gpx$/i, "");
  var match = base.match(/^(\d{4})-(\d{2})-(\d{2})[-_]?(.*)$/);
  var date = null;
  var title = base;
  if (match) {
    date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
    title = match[4] || "";
  }
  title = title.replace(/[-_]+/g, " ").trim();
  title = title.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  return { date: date, title: title };
}

/* -- Rendering ----------------------------------------------------------- */

function accentColour(el) {
  var c = getComputedStyle(el).getPropertyValue("--accent").trim();
  return c || "#002b8a";
}

function buildStats(stats, date) {
  var chips = [];
  if (date) chips.push(["Date", formatDate(date)]);
  chips.push(["Distance", formatDistance(stats.distanceKm)]);
  if (stats.hasTime) chips.push(["Duration", formatDuration(stats.durationMs)]);
  if (stats.hasEle) chips.push(["Ascent", Math.round(stats.ascent) + " m"]);
  return chips;
}

function renderStats(listEl, chips) {
  listEl.innerHTML = "";
  chips.forEach(function (chip) {
    var li = document.createElement("li");
    li.className = "gpxmap__stat";
    var label = document.createElement("span");
    label.className = "gpxmap__stat-label";
    label.textContent = chip[0];
    var value = document.createElement("span");
    value.className = "gpxmap__stat-value";
    value.textContent = chip[1];
    li.appendChild(label);
    li.appendChild(value);
    listEl.appendChild(li);
  });
}

function renderProfile(container, points, stats) {
  var W = 100, H = 30, PAD = 1;
  var eles = points.map(function (p) { return p.ele; });
  var min = Math.min.apply(null, eles);
  var max = Math.max.apply(null, eles);
  var range = max - min || 1;
  var total = stats.cumulative[stats.cumulative.length - 1] || 1;

  var coords = points.map(function (p, i) {
    var x = (stats.cumulative[i] / total) * W;
    var y = H - PAD - ((p.ele - min) / range) * (H - 2 * PAD);
    return x.toFixed(2) + "," + y.toFixed(2);
  });

  var line = "M" + coords.join(" L");
  var area = line + " L" + W + "," + H + " L0," + H + " Z";

  container.innerHTML =
    '<svg class="gpxmap__profile-svg" viewBox="0 0 ' + W + " " + H + '" ' +
    'preserveAspectRatio="none" aria-hidden="true">' +
    '<path class="gpxmap__profile-area" d="' + area + '" />' +
    '<path class="gpxmap__profile-line" d="' + line + '" />' +
    "</svg>" +
    '<div class="gpxmap__profile-range">' +
    "<span>" + Math.round(min) + " m</span>" +
    "<span>" + Math.round(max) + " m</span>" +
    "</div>";
  container.hidden = false;
}

function renderMap(mapEl, points, stats, accent) {
  var latlngs = points.map(function (p) { return [p.lat, p.lon]; });

  var map = L.map(mapEl, {
    scrollWheelZoom: false,
    attributionControl: true
  });

  L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
      'contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | ' +
      'Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> ' +
      '(<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
  }).addTo(map);

  // White casing beneath the accent line for the "poster" look.
  L.polyline(latlngs, { color: "#ffffff", weight: 7, opacity: 0.9 }).addTo(map);
  var route = L.polyline(latlngs, {
    color: accent,
    weight: 4,
    opacity: 1,
    lineJoin: "round",
    lineCap: "round"
  }).addTo(map);

  L.circleMarker(latlngs[0], {
    radius: 6, color: "#ffffff", weight: 2, fillColor: accent, fillOpacity: 1
  }).addTo(map).bindTooltip("Start");
  L.circleMarker(latlngs[latlngs.length - 1], {
    radius: 6, color: accent, weight: 2, fillColor: "#ffffff", fillOpacity: 1
  }).addTo(map).bindTooltip("Finish");

  map.fitBounds(route.getBounds(), { padding: [24, 24] });
  return map;
}

function renderRoute(figureEl, gpxText) {
  var parsed = parseGpx(gpxText);
  if (parsed.points.length < 2) {
    throw new Error("GPX file has no usable track");
  }
  var stats = computeStats(parsed.points);

  var fallback = fromFilename(figureEl.dataset.name || "");
  var date = stats.startTime || fallback.date;
  var title = parsed.name || fallback.title;

  var titleEl = figureEl.querySelector(".gpxmap__title");
  if (titleEl) titleEl.textContent = title;

  var statsEl = figureEl.querySelector(".gpxmap__stats");
  if (statsEl) renderStats(statsEl, buildStats(stats, date));

  var accent = accentColour(figureEl);
  var mapEl = figureEl.querySelector(".gpxmap__map");
  renderMap(mapEl, parsed.points, stats, accent);

  var wantProfile = figureEl.dataset.profile !== "false";
  var profileEl = figureEl.querySelector(".gpxmap__profile");
  if (wantProfile && stats.hasEle && profileEl) {
    renderProfile(profileEl, parsed.points, stats);
  }
}

/* -- Auto-init ----------------------------------------------------------- */

function initFigure(figureEl) {
  var url = figureEl.dataset.gpx;
  if (!url) return;
  fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error("Could not load GPX (" + res.status + ")");
      return res.text();
    })
    .then(function (text) { renderRoute(figureEl, text); })
    .catch(function (err) {
      var mapEl = figureEl.querySelector(".gpxmap__map");
      if (mapEl) {
        mapEl.classList.add("gpxmap__map--error");
        mapEl.textContent = err.message;
      }
    });
}

function init() {
  var figures = document.querySelectorAll(".gpxmap[data-gpx]");
  Array.prototype.forEach.call(figures, initFigure);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
