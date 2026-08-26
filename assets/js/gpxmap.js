/*
 * gpxmap.js — render a GPS track (GPX or FIT) on an OpenTopoMap Leaflet map
 * with computed stats and an optional elevation profile. Dependency-free:
 * GPX is parsed with the browser's DOMParser, FIT with a small DataView
 * decoder; Leaflet is loaded separately from a CDN.
 *
 * Entry point: renderRoute(figureEl, parsed) where parsed = { points, name }
 * from parseGpx/parseFit — kept separate from fetch/auto-init so the engine
 * is reusable.
 */

import { openPoster } from "./gpxposter.js";

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

/*
 * parseFit — decode the GPS track from a .fit file (Coros/Garmin/ANT-FIT).
 * Reads only `record` messages (global 20): position_lat/long (semicircles),
 * altitude/enhanced_altitude, and timestamp (incl. compressed-timestamp
 * headers). Dependency-free, via DataView. Returns the same shape as parseGpx.
 */
var FIT_EPOCH = 631065600; // FIT time base (1989-12-31 00:00:00 UTC) in Unix seconds

function parseFit(buffer) {
  var dv = new DataView(buffer);
  var headerSize = dv.getUint8(0);
  var dataSize = dv.getUint32(4, true);
  var pos = headerSize;
  var end = Math.min(headerSize + dataSize, dv.byteLength - 2); // trailing CRC

  var defs = {};      // local message type -> definition
  var lastTs = null;  // rolling timestamp for compressed headers
  var records = [];

  function readField(p, base, le) {
    switch (base) {
      case 0x85: return dv.getInt32(p, le);   // sint32
      case 0x86: return dv.getUint32(p, le);  // uint32
      case 0x84: return dv.getUint16(p, le);  // uint16
      case 0x83: return dv.getInt16(p, le);   // sint16
      case 0x01: return dv.getInt8(p);        // sint8
      case 0x00: case 0x02: case 0x0a: return dv.getUint8(p);
      case 0x88: return dv.getFloat32(p, le); // float32
      default: return null;
    }
  }

  function readData(def, isCompressed, timeOffset) {
    var rec = {};
    for (var i = 0; i < def.fields.length; i++) {
      var f = def.fields[i];
      rec[f.num] = readField(pos, f.base, def.le);
      pos += f.size;
    }
    for (var j = 0; j < def.devFields.length; j++) pos += def.devFields[j].size;

    if (isCompressed && lastTs != null) {
      var prev = lastTs & 0x1f;
      lastTs = timeOffset >= prev ? (lastTs - prev) + timeOffset
                                  : (lastTs - prev) + timeOffset + 0x20;
      rec[253] = lastTs;
    } else if (rec[253] != null) {
      lastTs = rec[253];
    }
    if (def.global === 20) records.push(rec);
  }

  while (pos < end) {
    var h = dv.getUint8(pos++);
    if (h & 0x80) {                       // compressed-timestamp data message
      var def = defs[(h >> 5) & 0x3];
      if (!def) break;
      readData(def, true, h & 0x1f);
    } else if (h & 0x40) {                // definition message
      var localType = h & 0x0f;
      pos++;                              // reserved
      var le = dv.getUint8(pos++) === 0;  // architecture: 0 = little-endian
      var global = dv.getUint16(pos, le); pos += 2;
      var nFields = dv.getUint8(pos++);
      var fields = [];
      for (var k = 0; k < nFields; k++) {
        var num = dv.getUint8(pos++), size = dv.getUint8(pos++), base = dv.getUint8(pos++);
        fields.push({ num: num, size: size, base: base });
      }
      var devFields = [];
      if (h & 0x20) {                     // developer fields
        var nDev = dv.getUint8(pos++);
        for (var d = 0; d < nDev; d++) {
          dv.getUint8(pos++); var ds = dv.getUint8(pos++); dv.getUint8(pos++);
          devFields.push({ size: ds });
        }
      }
      defs[localType] = { le: le, global: global, fields: fields, devFields: devFields };
    } else {                              // normal data message
      var d2 = defs[h & 0x0f];
      if (!d2) break;
      readData(d2, false);
    }
  }

  var SC = 180 / Math.pow(2, 31); // semicircles -> degrees
  var points = [];
  var lastEle = null;
  for (var r = 0; r < records.length; r++) {
    var rec = records[r];
    var rawLat = rec[0], rawLon = rec[1];
    if (rawLat == null || rawLon == null || rawLat === 0x7fffffff || rawLon === 0x7fffffff) {
      continue;
    }
    var ele = null;
    if (rec[78] != null && rec[78] !== 0xffffffff) ele = rec[78] / 5 - 500;
    else if (rec[2] != null && rec[2] !== 0xffff) ele = rec[2] / 5 - 500;
    if (ele == null) ele = lastEle; else lastEle = ele; // carry forward to fill gaps
    points.push({
      lat: rawLat * SC,
      lon: rawLon * SC,
      ele: ele,
      time: rec[253] != null ? new Date((rec[253] + FIT_EPOCH) * 1000) : null
    });
  }

  // Back-fill any leading points recorded before the first altitude fix, so the
  // whole track has elevation (otherwise the profile/ascent are dropped).
  var firstEle = null;
  for (var q = 0; q < points.length; q++) {
    if (points[q].ele != null) { firstEle = points[q].ele; break; }
  }
  if (firstEle != null) {
    for (var q2 = 0; q2 < points.length && points[q2].ele == null; q2++) {
      points[q2].ele = firstEle;
    }
  }
  return { points: points, name: "" };
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

// Derive a { date, title } fallback from a filename — either our convention
// "2026-08-24-kinder-scout.gpx" or a watch export like
// "SurreyTrailRun20260823101517.fit".
function fromFilename(name) {
  var base = name.replace(/\.(gpx|fit)$/i, "");
  var date = null;
  var title = base;

  var iso = base.match(/^(\d{4})-(\d{2})-(\d{2})[-_]?(.*)$/);
  var stamp = base.match(/^(.*?)(\d{4})(\d{2})(\d{2})(\d{6})?$/); // NameYYYYMMDD[HHMMSS]

  if (iso) {
    date = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    title = iso[4] || "";
  } else if (stamp && +stamp[3] >= 1 && +stamp[3] <= 12 && +stamp[4] >= 1 && +stamp[4] <= 31) {
    date = new Date(Date.UTC(+stamp[2], +stamp[3] - 1, +stamp[4]));
    title = stamp[1] || "";
  }

  title = title
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // split CamelCase ("TrailRun" -> "Trail Run")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
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
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, ' +
      '<a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
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

function renderRoute(figureEl, parsed) {
  if (parsed.points.length < 2) {
    throw new Error("Route file has no usable track");
  }
  var stats = computeStats(parsed.points);

  var fallback = fromFilename(figureEl.dataset.name || "");
  var date = stats.startTime || fallback.date;
  var title = figureEl.dataset.title || parsed.name || fallback.title;

  var chips = buildStats(stats, date);

  var titleEl = figureEl.querySelector(".gpxmap__title");
  if (titleEl) titleEl.textContent = title;

  var statsEl = figureEl.querySelector(".gpxmap__stats");
  if (statsEl) renderStats(statsEl, chips);

  var accent = accentColour(figureEl);
  var mapEl = figureEl.querySelector(".gpxmap__map");
  renderMap(mapEl, parsed.points, stats, accent);

  var wantProfile = figureEl.dataset.profile !== "false";
  var profileEl = figureEl.querySelector(".gpxmap__profile");
  if (wantProfile && stats.hasEle && profileEl) {
    renderProfile(profileEl, parsed.points, stats);
  }

  // Stash everything the poster needs so it renders with no re-parse.
  figureEl._walk = {
    coordinates: parsed.points.map(function (p) { return [p.lon, p.lat]; }),
    title: title,
    chips: chips,
    accent: accent,
    elevation: stats.hasEle
      ? parsed.points.map(function (p, i) { return [stats.cumulative[i], p.ele]; })
      : null
  };
  enablePoster(figureEl);
}

function enablePoster(figureEl) {
  var btns = figureEl.querySelectorAll(".gpxmap__poster-btn");
  Array.prototype.forEach.call(btns, function (btn) {
    btn.disabled = false;
    btn.addEventListener("click", function () {
      if (figureEl._walk) openPoster(figureEl._walk, btn.getAttribute("data-format"));
    });
  });
}

/* -- Auto-init ----------------------------------------------------------- */

function initFigure(figureEl) {
  var url = figureEl.dataset.gpx;
  if (!url) return;
  var isFit = /\.fit(\?.*)?$/i.test(url);
  fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error("Could not load route (" + res.status + ")");
      return isFit ? res.arrayBuffer() : res.text();
    })
    .then(function (data) {
      renderRoute(figureEl, isFit ? parseFit(data) : parseGpx(data));
    })
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
