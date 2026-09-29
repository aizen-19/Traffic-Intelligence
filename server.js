const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const cameras = [
  { id: "CAM-001", name: "University Road", lat: 23.1815, lng: 79.9864, status: "ONLINE", direction: "NORTH", vehicles: 31 },
  { id: "CAM-002", name: "Civic Centre", lat: 23.1762, lng: 79.9869, status: "ONLINE", direction: "EAST", vehicles: 24 },
  { id: "CAM-003", name: "Railway Road", lat: 23.1709, lng: 79.9505, status: "ONLINE", direction: "SOUTH", vehicles: 19 },
  { id: "CAM-004", name: "Main Square", lat: 23.1645, lng: 79.9367, status: "ONLINE", direction: "WEST", vehicles: 42 },
  { id: "CAM-005", name: "Bus Stand", lat: 23.1686, lng: 79.9399, status: "DEGRADED", direction: "NORTH", vehicles: 17 }
];

let vehicles = [
  { id: "V-1042", plate: "MP20AB1234", type: "SUV", color: "White", firstSeen: "10:05:12", lastSeen: "10:31:44", confidence: 0.94, status: "NORMAL", sightings: 7 },
  { id: "V-1077", plate: "MP20CD7788", type: "Sedan", color: "Black", firstSeen: "10:12:08", lastSeen: "10:37:51", confidence: 0.91, status: "WATCHLIST", sightings: 5 },
  { id: "V-1112", plate: "MP20EF5510", type: "Hatchback", color: "Blue", firstSeen: "10:18:21", lastSeen: "10:42:17", confidence: 0.88, status: "NORMAL", sightings: 4 },
  { id: "V-1130", plate: "MH12XY4567", type: "Truck", color: "Red", firstSeen: "10:21:11", lastSeen: "10:46:03", confidence: 0.86, status: "ANOMALY", sightings: 6 },
  { id: "V-1194", plate: "UP32AB9988", type: "Sedan", color: "Grey", firstSeen: "10:25:42", lastSeen: "10:52:16", confidence: 0.93, status: "NORMAL", sightings: 8 }
];

const trajectories = {
  "V-1042": [
    { camera: "CAM-001", time: "10:05:12", lat: 23.1815, lng: 79.9864, confidence: 0.96 },
    { camera: "CAM-002", time: "10:17:03", lat: 23.1762, lng: 79.9869, confidence: 0.91 },
    { camera: "CAM-003", time: "10:24:28", lat: 23.1709, lng: 79.9505, confidence: 0.88 },
    { camera: "CAM-004", time: "10:31:44", lat: 23.1645, lng: 79.9367, confidence: 0.94 }
  ],
  "V-1077": [
    { camera: "CAM-001", time: "10:12:08", lat: 23.1815, lng: 79.9864, confidence: 0.93 },
    { camera: "CAM-002", time: "10:21:39", lat: 23.1762, lng: 79.9869, confidence: 0.89 },
    { camera: "CAM-005", time: "10:37:51", lat: 23.1686, lng: 79.9399, confidence: 0.86 }
  ],
  "V-1130": [
    { camera: "CAM-003", time: "10:21:11", lat: 23.1709, lng: 79.9505, confidence: 0.90 },
    { camera: "CAM-004", time: "10:28:37", lat: 23.1645, lng: 79.9367, confidence: 0.84 },
    { camera: "CAM-005", time: "10:46:03", lat: 23.1686, lng: 79.9399, confidence: 0.72 }
  ]
};

let alerts = [
  { id: "AL-9001", type: "WATCHLIST MATCH", plate: "MP20CD7788", camera: "CAM-002", time: "10:21:40", severity: "HIGH", confidence: 0.97, status: "ACTIVE" },
  { id: "AL-9002", type: "ROUTE ANOMALY", plate: "MH12XY4567", camera: "CAM-005", time: "10:46:05", severity: "MEDIUM", confidence: 0.82, status: "ACTIVE" },
  { id: "AL-9003", type: "OCR UNCERTAINTY", plate: "MP20?F1234", camera: "CAM-003", time: "10:39:14", severity: "LOW", confidence: 0.63, status: "REVIEW" }
];



// Traffic-signal graph used by the Next Signal Traffic Prediction feature.
// Cameras are available at A-D; E and F are intentionally camera-less.
const signalGraph = {
  A: { name: "Signal A", camera: "CAM-001", next: ["B"] },
  B: { name: "Signal B", camera: "CAM-002", next: ["C"] },
  C: { name: "Signal C", camera: "CAM-003", next: ["D"] },
  D: { name: "Signal D", camera: "CAM-004", next: ["E", "F"] },
  E: { name: "Signal E", camera: null, next: [] },
  F: { name: "Signal F", camera: null, next: [] }
};

const signalHistory = {
  A: [38, 41, 44, 46, 48],
  B: [29, 31, 34, 35, 37],
  C: [18, 20, 22, 24, 24],
  D: [34, 37, 39, 41, 42]
};

function trafficLevel(value) {
  if (value >= 45) return "CRITICAL";
  if (value >= 35) return "HIGH";
  if (value >= 20) return "MEDIUM";
  return "LOW";
}

function levelRank(level) {
  return { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[level] ?? 0;
}

function cameraTrafficForSignal(signalId) {
  const node = signalGraph[signalId];
  if (!node || !node.camera) return null;
  const camera = cameras.find(c => c.id === node.camera);
  if (!camera) return null;
  return { vehicles: camera.vehicles, level: trafficLevel(camera.vehicles), camera: camera.id };
}

function predictNextSignal(currentId) {
  const current = signalGraph[currentId] || signalGraph.A;
  const observed = cameraTrafficForSignal(currentId) || { vehicles: 0, level: "LOW", camera: null };
  const history = signalHistory[currentId] || [];
  const trend = history.length >= 2 ? history[history.length - 1] - history[history.length - 2] : 0;
  const next = current.next.map((nextId, index) => {
    const node = signalGraph[nextId];
    const nextObserved = cameraTrafficForSignal(nextId);
    // Propagate a portion of the current load to the next node. If a camera is
    // unavailable, this remains a prediction and is never presented as detected.
    const recentPressure = Math.max(observed.vehicles, history[history.length - 1] || observed.vehicles);
    const projected = Math.round(recentPressure * 0.82 + Math.max(trend, 0) * 1.2 + index * 2);
    const predictedVehicles = nextObserved ? nextObserved.vehicles : projected;
    const predictedLevel = nextObserved
      ? trafficLevel(nextObserved.vehicles)
      : trafficLevel(projected);
    const confidence = Math.min(97, Math.max(62,
      70 + (Math.abs(trend) * 3) + (observed.level === "HIGH" ? 9 : observed.level === "CRITICAL" ? 13 : 0) + ((history[history.length - 1] || 0) >= 35 ? 8 : 0) + (history.length >= 4 ? 3 : 0)
    ));
    const status = nextObserved ? "Detected — Camera Available" : "Predicted — No Camera";
    const action = levelRank(predictedLevel) >= 3
      ? "Immediate traffic-management response"
      : levelRank(predictedLevel) === 2
        ? "Alert traffic police and prepare deployment"
        : levelRank(predictedLevel) === 1
          ? "Monitor the next signal"
          : "No action required";
    return {
      signal: nextId,
      signalName: node.name,
      cameraAvailable: !!node.camera,
      camera: node.camera,
      currentSignal: currentId,
      currentTraffic: observed.level,
      currentVehicles: observed.vehicles,
      predictedTraffic: predictedLevel,
      predictedVehicles,
      confidence,
      status,
      action,
      severity: predictedLevel
    };
  });
  return {
    currentSignal: currentId,
    currentSignalName: current.name,
    currentTraffic: observed.level,
    currentVehicles: observed.vehicles,
    trend,
    nextSignals: next,
    graphPath: [currentId, ...current.next],
    generatedAt: new Date().toISOString()
  };
}

app.get("/api/traffic/signals", (req, res) => {
  res.json(Object.entries(signalGraph).map(([id, node]) => ({
    id, name: node.name, camera: node.camera, next: node.next,
    traffic: cameraTrafficForSignal(id)
  })));
});

app.get("/api/next-signal-alert", (req, res) => {
  const current = String(req.query.current || "A").toUpperCase();
  if (!signalGraph[current]) return res.status(400).json({ message: "Unknown signal", validSignals: Object.keys(signalGraph) });
  res.json(predictNextSignal(current));
});

app.get("/api/health", (req, res) => res.json({ ok: true, service: "TEAM FORGE-1 API", time: new Date().toISOString() }));
app.get("/api/cameras", (req, res) => res.json(cameras));
app.get("/api/vehicles", (req, res) => res.json(vehicles));
app.get("/api/alerts", (req, res) => res.json(alerts));

app.get("/api/vehicles/search", (req, res) => {
  const q = String(req.query.plate || "").trim().toUpperCase();
  if (!q) return res.json(vehicles);
  return res.json(vehicles.filter(v => v.plate.includes(q)));
});

app.get("/api/vehicles/:id", (req, res) => {
  const v = vehicles.find(x => x.id === req.params.id || x.plate === req.params.id.toUpperCase());
  if (!v) return res.status(404).json({ message: "Vehicle not found" });
  res.json({ ...v, trajectory: trajectories[v.id] || [] });
});

app.get("/api/analytics/summary", (req, res) => {
  res.json({
    vehiclesToday: 8521,
    activeCameras: 4,
    totalCameras: 5,
    activeAlerts: alerts.filter(a => a.status !== "RESOLVED").length,
    congestionZones: 7,
    avgSpeed: 34.6,
    recognitionAccuracy: 92.8,
    trackedJourneys: 3164
  });
});

app.get("/api/analytics/hourly", (req, res) => {
  res.json({
    labels: ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"],
    values: [420, 880, 1240, 1090, 1320, 1480, 1650, 1210]
  });
});

app.get("/api/analytics/density", (req, res) => {
  res.json(cameras.map(c => ({
    camera: c.id, name: c.name, vehicles: c.vehicles,
    level: c.vehicles > 35 ? "HIGH" : c.vehicles > 20 ? "MEDIUM" : "LOW"
  })));
});

app.post("/api/watchlist/check", (req, res) => {
  const plate = String(req.body.plate || "").toUpperCase();
  const match = vehicles.find(v => v.plate === plate && v.status === "WATCHLIST");
  res.json({ match: !!match, plate, vehicle: match || null });
});

app.post("/api/alerts/:id/resolve", (req, res) => {
  const a = alerts.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ message: "Alert not found" });
  a.status = "RESOLVED";
  res.json(a);
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`TEAM FORGE-1 • SIH running at http://localhost:${PORT}`));
