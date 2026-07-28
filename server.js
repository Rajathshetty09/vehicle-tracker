const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Initialize Express app and HTTP server FIRST
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware to parse JSON body payloads
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simulated Database of Vehicles
let vehiclesDB = [
  {
    id: "KA-01-AB-1234",
    driver: "Rajath Shetty",
    phone: "7259765738",
    status: "Idle",
    lat: 12.9357,
    lng: 77.6227,
    speed: 0,
    isLiveGPS: false
  },
  {
    id: "KA-05-XY-9876",
    driver: "Abhishek",
    phone: "8391973053",
    status: "Idle",
    lat: 12.9357,
    lng: 77.6227,
    speed: 0,
    isLiveGPS: false
  },
  {
    id: "MH-12-PQ-4567",
    driver: "Raksha",
    phone: "8762427560",
    status: "Idle",
    lat: 12.9279,
    lng: 77.6271,
    speed: 0,
    isLiveGPS: false
  }
];

// 1. Get all vehicles API
app.get('/api/vehicles', (req, res) => {
  res.json(vehiclesDB);
});

// 2. Dual Search API (by Plate OR Phone)
app.get('/api/vehicles/search/:query', (req, res) => {
  const searchQuery = req.params.query.toLowerCase().replace(/\s+/g, '');

  const vehicle = vehiclesDB.find(v => 
    v.id.toLowerCase().replace(/\s+/g, '') === searchQuery || 
    v.phone.includes(searchQuery)
  );

  if (!vehicle) {
    return res.status(404).json({ message: "No vehicle found matching plate or phone number." });
  }

  res.json(vehicle);
});

// 3. Driver Live Location Endpoint
app.post('/api/driver/update-location', (req, res) => {
  const { identifier, lat, lng, speed } = req.body;

  if (!identifier || !lat || !lng) {
    return res.status(400).json({ message: "Missing location or vehicle/phone details." });
  }

  const index = vehiclesDB.findIndex(v => 
    v.id.toLowerCase().replace(/\s+/g, '') === identifier.toLowerCase().replace(/\s+/g, '') || 
    v.phone.includes(identifier)
  );

  if (index !== -1) {
    vehiclesDB[index].lat = parseFloat(lat);
    vehiclesDB[index].lng = parseFloat(lng);
    vehiclesDB[index].speed = speed ? parseFloat(speed) : 0;
    vehiclesDB[index].status = parseFloat(speed) > 0 ? "Moving" : "Idle";
    vehiclesDB[index].isLiveGPS = true; // Prevents simulation jitter from overriding real GPS

    io.emit('locationUpdate', vehiclesDB);
    return res.json({ success: true, message: "Location updated successfully." });
  }

  res.status(404).json({ message: "Vehicle/Driver not found." });
});

// Simulation loop (ONLY moves vehicles that aren't using live mobile GPS)
setInterval(() => {
  vehiclesDB = vehiclesDB.map(v => {
    if (v.status === 'Moving' && !v.isLiveGPS) {
      const newLat = v.lat + (Math.random() - 0.5) * 0.001;
      const newLng = v.lng + (Math.random() - 0.5) * 0.001;
      const newSpeed = Math.floor(30 + Math.random() * 25);
      return { ...v, lat: newLat, lng: newLng, speed: newSpeed };
    }
    return v;
  });

  io.emit('locationUpdate', vehiclesDB);
}, 2000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});