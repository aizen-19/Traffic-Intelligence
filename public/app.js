let map, flowChart, analyticsChart, cameraMarkers = [], trajectoryLayer;
const $ = id => document.getElementById(id);
const api = async (url, options = {}) => (await fetch(url, options)).json();

function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2600); }

document.querySelectorAll(".nav").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
document.querySelectorAll("[data-view-target]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.viewTarget)));
$("refreshBtn").onclick = () => { loadDashboard(); toast("Dashboard refreshed"); };
function showView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
  $(view).classList.add("active-view");
  document.querySelectorAll(".nav").forEach(n => n.classList.toggle("active", n.dataset.view === view));
  const titles = { overview: "Command Center", live: "Live Cameras", vehicles: "Vehicle Intelligence", analytics: "Traffic Analytics", alerts: "Alert Center" };
  $("pageTitle").textContent = titles[view];
  if (view === "live") loadCameras();
  if (view === "analytics") loadAnalytics();
  if (view === "alerts") loadAlerts(true);
  if (view === "overview" && map) setTimeout(() => map.invalidateSize(), 100);
}
function focusMap() { showView("overview"); map.setView([23.173, 79.96], 13); }

let nextSignalTimer;
let selectedSignal = "A";

function signalLevelClass(level) { return String(level || "LOW").toLowerCase(); }
function signalIcon(level) {
  return level === "CRITICAL" ? "🚨" : level === "HIGH" ? "🔴" : level === "MEDIUM" ? "🟡" : "🟢";
}

async function loadNextSignalAlert(currentSignal = selectedSignal) {
  selectedSignal = currentSignal;
  try {
    const d = await api(`/api/next-signal-alert?current=${encodeURIComponent(currentSignal)}`);
    const next = d.nextSignals?.[0];
    if (!next) { $("nextSignalAlert").innerHTML = '<div class="empty">No connected next signal.</div>'; return; }
    const police = next.predictedTraffic === "HIGH" || next.predictedTraffic === "CRITICAL";
    const currentClass = signalLevelClass(d.currentTraffic);
    const nextClass = signalLevelClass(next.predictedTraffic);
    $("nextSignalAlert").innerHTML = `
      <div class="signal-route"><span>${d.currentSignal}</span><i>→</i><strong>${next.signal}</strong>${d.nextSignals.length > 1 ? `<small> +${d.nextSignals.length - 1} branch</small>` : ""}</div>
      <div class="signal-grid">
        <div><small>Current Signal</small><b>${d.currentSignal}</b></div>
        <div><small>Current Traffic</small><b class="signal-${currentClass}">${signalIcon(d.currentTraffic)} ${d.currentTraffic}</b></div>
        <div><small>Next Signal</small><b>${next.signal}</b></div>
        <div><small>Predicted Traffic</small><b class="signal-${nextClass}">${signalIcon(next.predictedTraffic)} ${next.predictedTraffic}</b></div>
      </div>
      <div class="prediction-status ${next.cameraAvailable ? 'detected' : 'predicted'}">
        <div><b>${next.cameraAvailable ? '📷 Detected Traffic' : '⚠ Predicted — No Camera'}</b><small>${next.cameraAvailable ? `Camera ${next.camera} available` : `No camera at ${next.signal}; estimate propagated from ${d.currentSignal}`}</small></div>
        <strong>${next.confidence}%</strong>
      </div>
      <div class="confidence-row"><span>Prediction Confidence</span><b>${next.confidence}%</b></div>
      <div class="confidence-bar"><span style="width:${next.confidence}%"></span></div>
      <div class="action-box ${police ? 'action-high' : 'action-monitor'}">
        <b>${police ? '⚠ ACTION REQUIRED' : 'ℹ MONITOR'}</b>
        <p>${police ? 'High traffic is predicted at the next signal. Traffic police should be alerted and deployed at this location to manage traffic.' : next.action + '.'}</p>
      </div>
      <div class="signal-actions"><button class="ghost" onclick="focusSignalOnMap('${next.signal}')">View Signal</button><button class="alert-police" onclick="alertTrafficPolice('${d.currentSignal}','${next.signal}','${next.predictedTraffic}',${next.confidence})">${police ? 'Alert Police' : 'Create Alert'}</button></div>
      ${d.nextSignals.length > 1 ? `<div class="branch-list"><small>Connected next signals</small>${d.nextSignals.map(x => `<span>${x.signal} • ${x.predictedTraffic} • ${x.cameraAvailable ? 'Camera' : 'No Camera'}</span>`).join('')}</div>` : ''}
      <div class="prediction-foot">Updated ${new Date(d.generatedAt).toLocaleTimeString()} • Graph path: ${d.graphPath.join(' → ')}</div>`;
  } catch (e) {
    $("nextSignalAlert").innerHTML = '<div class="empty">Prediction service unavailable.</div>';
  }
}

function initSignalSelector() {
  const selector = $("signalSelector");
  if (!selector) return;
  selector.value = selectedSignal;
  selector.onchange = () => loadNextSignalAlert(selector.value);
}

function startNextSignalUpdates() {
  loadNextSignalAlert(selectedSignal);
  clearInterval(nextSignalTimer);
  nextSignalTimer = setInterval(() => loadNextSignalAlert(selectedSignal), 5000);
}

function focusSignalOnMap(signal) {
  const signalMap = { A: [23.1815, 79.9864], B: [23.1762, 79.9869], C: [23.1709, 79.9505], D: [23.1645, 79.9367], E: [23.1628, 79.9290], F: [23.1608, 79.9440] };
  showView("overview");
  if (map && signalMap[signal]) map.setView(signalMap[signal], 14);
  toast(`Focused map on Signal ${signal}`);
}

function alertTrafficPolice(current, next, traffic, confidence) {
  const msg = `⚠ High traffic predicted at Signal ${next}. Traffic police should be alerted and deployed. Current: ${current} • Predicted: ${traffic} • Confidence: ${confidence}% • Camera: No camera`;
  toast(msg);
  const alertsEl = $("alertList");
  if (alertsEl) {
    const card = document.createElement("div");
    card.className = "alert-item prediction-alert-flash";
    card.innerHTML = `<div class="alert-top"><span class="alert-type high">NEXT SIGNAL PREDICTION</span><span class="alert-type">${confidence}%</span></div><div class="alert-meta">${current} → ${next} • ${traffic} • Predicted — No Camera</div>`;
    alertsEl.prepend(card);
    setTimeout(() => card.remove(), 8000);
  }
}

async function loadDashboard() {
  const s = await api("/api/analytics/summary");
  $("sVehicles").textContent = s.vehiclesToday.toLocaleString(); $("sCameras").textContent = s.activeCameras; $("sAlerts").textContent = s.activeAlerts; $("sAccuracy").textContent = s.recognitionAccuracy + "%";
  $("navAlertCount").textContent = s.activeAlerts;
  loadAlerts(false); loadDensity(); loadFlow(); initMap(); initSignalSelector(); startNextSignalUpdates();
}
async function loadFlow() {
  const d = await api("/api/analytics/hourly");
  if (flowChart) flowChart.destroy();
  flowChart = new Chart($("flowChart"), { type: "line", data: { labels: d.labels, datasets: [{ data: d.values, borderColor: "#0f766e", backgroundColor: "rgba(15,118,110,.1)", fill: true, tension: .4, pointRadius: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: "#7a7265", font: { size: 9 } } }, y: { grid: { color: "#e5e0d8" }, ticks: { color: "#7a7265", font: { size: 9 } } } } } });
}
async function loadDensity() {
  const data = await api("/api/analytics/density");
  $("densityList").innerHTML = data.map(x => `<div class="density-row"><div><div class="density-name">${x.name}</div><div class="density-sub">${x.camera} • ${x.vehicles} vehicles/min</div></div><span class="density-pill ${x.level.toLowerCase()}">${x.level}</span></div>`).join("");
}
async function loadAlerts(full) {
  const data = await api("/api/alerts");
  const active = data.filter(a => a.status !== "RESOLVED");
  const list = full ? data : active.slice(0, 3);
  const html = list.map(a => alertHtml(a, full)).join("");
  (full ? $("fullAlerts") : $("alertList")).innerHTML = html || `<div class="empty">No active alerts.</div>`;
  document.querySelectorAll(".resolve").forEach(b => b.onclick = async () => { await api("/api/alerts/" + b.dataset.id + "/resolve", { method: "POST" }); toast("Alert resolved"); loadDashboard(); if (full) loadAlerts(true); });
}
function alertHtml(a, full = false) {
  return full
    ? `<div class="full-alert"><div><b class="${a.severity.toLowerCase()}">${a.type}</b><small>${a.id}</small></div><div><b>${a.plate}</b><small>${a.camera} • ${a.time}</small></div><div><b>${Math.round(a.confidence * 100)}%</b><small>confidence</small></div><button class="resolve" data-id="${a.id}">${a.status === "RESOLVED" ? "Resolved" : "Resolve"}</button></div>`
    : `<div class="alert-item"><div class="alert-top"><span class="alert-type ${a.severity.toLowerCase()}">${a.type}</span><span class="alert-type">${Math.round(a.confidence * 100)}%</span></div><div class="alert-meta">${a.plate} • ${a.camera} • ${a.time}</div></div>`;
}
async function initMap() {
  if (map) { map.invalidateSize(); return; }
  map = L.map("map", { zoomControl: true }).setView([23.173, 79.96], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
  const cams = await api("/api/cameras");
  cams.forEach(c => {
    const m = L.circleMarker([c.lat, c.lng], { radius: 7, color: "#0f766e", fillColor: "#0f766e", fillOpacity: .9 }).addTo(map);
    m.bindPopup(`<b>${c.id}</b><br>${c.name}<br>Status: ${c.status}`);
    cameraMarkers.push(m);
  });
  const v = await api("/api/vehicles/V-1042");
  const latlng = v.trajectory.map(p => [p.lat, p.lng]);
  trajectoryLayer = L.polyline(latlng, { color: "#0f766e", weight: 3, dashArray: "7 6" }).addTo(map);
  animateMarker(latlng);
  latlng.forEach((p, i) => L.circleMarker(p, { radius: 4, color: "#071018", fillColor: "#0f766e", fillOpacity: 1 }).addTo(map).bindTooltip(v.trajectory[i].camera));
}
async function loadCameras() {
  const cams = await api("/api/cameras");
  $("cameraFilter").innerHTML = '<option>All cameras</option>' + cams.map(c => `<option>${c.id}</option>`).join("");
  renderCameras(cams);
  $("cameraFilter").onchange = () => renderCameras(cams.filter(c => $("cameraFilter").value === "All cameras" || c.id === $("cameraFilter").value));
}
function renderCameras(cams) {
  $("cameraGrid").innerHTML = cams.map((c, i) => `<div class="camera-card"><div class="camera-feed"><div class="road"><div class="lane"></div></div><div class="car" style="left:${35 + i * 6}%"></div><div class="box" style="left:${31 + i * 6}%"><span>CAR • ${Math.round(.88 + i * .02 * 100)}%</span></div><div class="camera-overlay"><span class="cam-live">● ${c.status === "ONLINE" ? "LIVE" : "DEGRADED"}</span><span class="cam-code">${c.id}</span></div></div><div class="camera-info"><h3>${c.name}</h3><p>${c.direction}BOUND • ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}</p><div class="camera-stats"><div><b>${c.vehicles}</b><small>vehicles/min</small></div><div><b>${c.status}</b><small>status</small></div><div><b>92%</b><small>ANPR confidence</small></div></div></div></div>`).join("");
}
async function searchVehicle(plate) {
  const data = await api("/api/vehicles/search?plate=" + encodeURIComponent(plate));
  if (!data.length) { $("vehicleResult").innerHTML = `<div class="empty">No vehicle found for <b>${plate}</b>.</div>`; return; }
  const v = await api("/api/vehicles/" + data[0].id);
  const tr = v.trajectory || [];
  $("vehicleResult").classList.remove("empty");
  $("vehicleResult").innerHTML = `<div class="vehicle-header"><div><div class="eyebrow">GLOBAL VEHICLE ID ${v.id}</div><div class="plate">${v.plate}</div><div class="vehicle-tags"><span class="tag">${v.type}</span><span class="tag">${v.color}</span><span class="tag">${v.status}</span></div></div><div class="score">${Math.round(v.confidence * 100)}% identity confidence</div></div>
  <div class="vehicle-layout"><div class="evidence"><h3>IDENTITY EVIDENCE</h3>
    <div class="evidence-row"><span>Plate OCR</span><b class="score">94%</b></div><div class="evidence-row"><span>Visual Re-ID</span><b class="score">91%</b></div><div class="evidence-row"><span>Time feasibility</span><b class="score">97%</b></div><div class="evidence-row"><span>Spatial feasibility</span><b class="score">88%</b></div><div class="evidence-row"><span>Direction</span><b class="score">92%</b></div>
    <div class="evidence-row"><span>First seen</span><b>${v.firstSeen}</b></div><div class="evidence-row"><span>Last seen</span><b>${v.lastSeen}</b></div></div>
    <div class="trajectory"><h3>CROSS-CAMERA TRAJECTORY • ${tr.length} OBSERVATIONS</h3><div class="timeline">${tr.map(p => `<div class="event"><b>${p.camera} • ${p.time}</b><small>${p.lat.toFixed(4)}, ${p.lng.toFixed(4)} • match confidence ${Math.round(p.confidence * 100)}%</small></div>`).join("")}</div></div></div>`;
}
$("searchBtn").onclick = () => searchVehicle($("vehicleSearch").value.trim());
$("vehicleSearch").addEventListener("keydown", e => { if (e.key === "Enter") $("searchBtn").click() });
$("demoSearch").onclick = () => { $("vehicleSearch").value = "MP20AB1234"; searchVehicle("MP20AB1234"); };
async function loadAnalytics() {
  const d = await api("/api/analytics/hourly");
  if (analyticsChart) analyticsChart.destroy();
  analyticsChart = new Chart($("analyticsChart"), { type: "bar", data: { labels: d.labels, datasets: [{ data: d.values, backgroundColor: "rgba(15,118,110,.6)", borderColor: "#0f766e", borderWidth: 1, borderRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: "#7a7265" } }, y: { grid: { color: "#e5e0d8" }, ticks: { color: "#7a7265" } } } } });
}
$("clearResolved").onclick = async () => { const data = await api("/api/alerts"); for (const a of data.filter(x => x.status !== "RESOLVED")) await api("/api/alerts/" + a.id + "/resolve", { method: "POST" }); toast("Visible alerts resolved"); loadAlerts(true); loadDashboard(); };
loadDashboard();


let heatLayer;
let isHeatmapActive = false;

window.toggleHeatmap = function() {
  isHeatmapActive = !isHeatmapActive;
  const btn = document.getElementById("heatmapToggle");
  if (isHeatmapActive) {
    btn.style.background = "var(--cyan)";
    btn.style.color = "#ffffff";
    if (!heatLayer) {
      const heatData = [];
      cameraMarkers.forEach(m => {
        const ll = m.getLatLng();
        heatData.push([ll.lat, ll.lng, Math.random() * 0.5 + 0.5]);
        for (let i = 0; i < 8; i++) {
          heatData.push([
            ll.lat + (Math.random() - 0.5) * 0.006,
            ll.lng + (Math.random() - 0.5) * 0.006,
            Math.random() * 0.6
          ]);
        }
      });
      for(let i=0; i<15; i++) {
          heatData.push([23.173 + (Math.random()-0.5)*0.03, 79.96 + (Math.random()-0.5)*0.03, Math.random() * 0.4]);
      }
      heatLayer = L.heatLayer(heatData, {
        radius: 22,
        blur: 18,
        maxZoom: 14,
        gradient: {0.3: 'blue', 0.5: 'cyan', 0.7: 'lime', 0.9: 'yellow', 1.0: 'red'}
      });
    }
    heatLayer.addTo(map);
    toast("Traffic Congestion Heatmap Enabled");
  } else {
    btn.style.background = "";
    btn.style.color = "var(--cyan)";
    if (heatLayer) map.removeLayer(heatLayer);
    toast("Heatmap Disabled");
  }
};



window.simulateThreat = function() {
  toast("🚨 CRITICAL: Watchlist Match Detected!");
  
  const alertsEl = document.getElementById("alertList");
  if (alertsEl) {
    const card = document.createElement("div");
    card.className = "alert-item prediction-alert-flash";
    const plate = "MP20CD" + Math.floor(1000 + Math.random() * 9000);
    const cam = "CAM-00" + Math.floor(1 + Math.random() * 5);
    card.innerHTML = `<div class="alert-top"><span class="alert-type high">WATCHLIST MATCH</span><span class="alert-type">99%</span></div><div class="alert-meta">${plate} • ${cam} • Just now</div>`;
    alertsEl.prepend(card);
    setTimeout(() => card.classList.remove('prediction-alert-flash'), 2000);
  }
  
  if (map) {
     const lat = 23.173 + (Math.random() - 0.5) * 0.04;
     const lng = 79.96 + (Math.random() - 0.5) * 0.04;
     const marker = L.circleMarker([dat, lng], {
        radius: 12,
        color: '#e11d48',
        fillColor: '#e11d48',
        fillOpacity: 0.8,
        className: 'pulse-marker'
     }).addTo(map);
     marker.bindPopup(`<b>🚨 WATCHLIST MATCH</b><br>Plate: ${plate}<br>Action: Intercept immediately`).openPopup();
     map.setView([lat, lng], 15);
     setTimeout(() => map.removeLayer(marker), 15000);
  }
};


window.animateMarker = function(latlngs) {
  if (!latlngs || latlngs.length < 2 || !map) return;
  let currentStep = 0;
  const numSteps = 120;
  let currentSegment = 0;
  const movingMarker = L.circleMarker(latlngs[0], { radius: 7, color: '#ffffff', weight: 2, fillColor: '#d97706', fillOpacity: 1, zIndexOffset: 1000 }).addTo(map);
  movingMarker.bindTooltip("Live Tracked Vehicle", {permanent: true, direction: "top", offset: [0, -5], className: "tracking-label"});
  
  function tick() {
    if(!map.hasLayer(movingMarker)) return;
    if (currentSegment >= latlngs.length - 1) {
       currentSegment = 0;
       currentStep = 0;
    }
    const p1 = latlngs[currentSegment];
    const p2 = latlngs[currentSegment + 1];
    const progress = currentStep / numSteps;
    const lat = p1[0] + (p2[0] - p1[0]) * progress;
    const lng = p1[1] + (p2[1] - p1[1]) * progress;
    movingMarker.setLatLng([lat, lng]);
    currentStep++;
    if (currentStep >= numSteps) {
      currentStep = 0;
      currentSegment++;
    }
    requestAnimationFrame(tick);
  }
  tick();
};
