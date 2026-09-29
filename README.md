# NEURAL FORGE — SmartTraffic NETRA Traffic Intelligence

## New feature: Next Signal Traffic Prediction & Alert

This version adds an early-intervention traffic prediction panel to the existing Node.js/Express dashboard.

### Signal graph
- A → B → C → D
- D → E and D → F
- Cameras: A, B, C, D
- No cameras: E, F

### What the feature does
- Reads current traffic density from the current camera-equipped signal.
- Classifies traffic as LOW / MEDIUM / HIGH / CRITICAL.
- Uses recent traffic pressure, trend and the signal graph to estimate the next signal.
- Clearly distinguishes **Detected Traffic** from **Predicted — No Camera**.
- Shows prediction confidence and recommended action.
- Displays an actionable police alert when predicted traffic is HIGH or CRITICAL.
- Provides View Signal and Alert Police actions.
- Automatically refreshes the prediction every 5 seconds.
- The Current Signal selector lets you demonstrate A, B, C and D during the SIH demo. Selecting D demonstrates the E/F no-camera branch.

### New APIs
- `GET /api/traffic/signals`
- `GET /api/next-signal-alert?current=A`

### Run
```bash
npm install
npm run dev
```

Open `http://localhost:5000`.

The project remains a prototype and the prediction values are demo/simulated values until connected to real camera traffic measurements and a trained prediction model.
