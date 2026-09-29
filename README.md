# SmartTraffic Team Forge - Traffic Intelligence Platform

## Overview
SmartTraffic Team Forge is a City-Wide AI Platform designed for Multi-Camera Automatic Number Plate Recognition (ANPR) and Traffic Analytics. The platform addresses the challenges of isolated camera silos, challenging recognition conditions, and lack of cross-camera tracking by integrating distributed camera streams into a centralized data fusion layer. 

This repository contains the interactive dashboard and backend prototype, demonstrating the platform's capabilities through simulated data endpoints.

## Key Features

* **Multi-Camera Data Fusion**: Integrates distributed camera streams into a common processing layer to eliminate isolated ANPR data silos.
* **Spatio-Temporal Vehicle Tracking**: Performs cross-camera association to reconstruct the chronological route of specific vehicles across the city.
* **AI-Powered ANPR and OCR**: Designed to interface with deep-learning-based detection and OCR pipelines to handle diverse environmental conditions.
* **GIS-Integrated Traffic Analytics**: Converts large-scale camera observations into congestion heatmaps, density metrics, and mobility trends on an interactive map.
* **Real-Time Alert & Monitoring Engine**: Enables automated watchlist matching and anomaly detection for rapid identification of high-interest vehicles.
* **Next Signal Traffic Prediction**: Analyzes current traffic pressure and signal graphs to predict downstream congestion, allowing for early police intervention even at intersections without cameras.

## Technical Stack

* **Frontend**: HTML5, CSS3, Vanilla JavaScript
* **Mapping & Visualization**: Leaflet.js (GIS), Chart.js (Analytics)
* **Backend**: Node.js, Express.js
* **Architecture**: REST API architecture serving JSON data to a decoupled frontend.

## Getting Started

### Prerequisites
* Node.js (v14 or higher recommended)
* npm (Node Package Manager)

### Installation
1. Clone the repository and navigate to the project directory.
2. Install the required dependencies:
   ```bash
   npm install
   ```

### Running the Application
To start the development server with live reloading:
```bash
npm run dev
```
Or to start the standard server:
```bash
npm start
```

Once running, the application will be accessible at `http://localhost:5000`.

## Key API Endpoints

The Express backend serves several mock endpoints to power the dashboard:
* `/api/analytics/summary` - Aggregated daily statistics.
* `/api/analytics/hourly` - Traffic volume timeline data.
* `/api/analytics/density` - Current camera load and congestion levels.
* `/api/alerts` - Active system and watchlist alerts.
* `/api/cameras` - Live camera network status and coordinates.
* `/api/vehicles/search?plate={id}` - Vehicle identity evidence and trajectory data.
* `/api/next-signal-alert?current={signal}` - Predictive traffic logic for adjacent network nodes.

## Project Status
This repository serves as a high-fidelity prototype and UI dashboard. The data presented (including vehicles, alerts, and predictions) is currently simulated for demonstration purposes. The architecture is designed to be directly integrated with actual AI inference pipelines (e.g., YOLO, ByteTrack, OCR modules) and PostgreSQL/PostGIS databases in a production environment.
