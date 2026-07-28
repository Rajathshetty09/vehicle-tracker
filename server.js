const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// 1. Initialize express app FIRST
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 2. NOW add middleware
app.use(express.json());
app.use(express.static('public')); // or wherever your static HTML/JS files are stored

// Attach io to request object if needed
app.use((req, res, next) => {
  req.io = io;
  next();
});

// In-memory vehicles storage
let vehicles = [];

// API route to get all vehicles
app.get('/api/vehicles', (req, res) => {
  res.json(vehicles);
});

// POST endpoint targeted by driver.html
app.post('/api/driver/update-location', (req, res) => {
  const { identifier, lat, lng, speed } = req.body;

  if (!identifier || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const phone = identifier.replace(/[^0-9]/g, '');

  let vehicle = vehicles.find(v => v.phone === phone || v.identifier === phone);

  if (!vehicle) {
    vehicle = {
      id: `VEH-${phone.slice(-4)}`,
      plate: `DL-${phone.slice(-4)}`,
      phone: phone,
      identifier: phone,
      lat: Number(lat),
      lng: Number(lng),
      speed: Number(speed) || 0,
      status: 'Live',
      lastUpdated: new Date()
    };
    vehicles.push(vehicle);
    console.log(`New driver registered: ${phone}`);
  } else {
    vehicle.lat = Number(lat);
    vehicle.lng = Number(lng);
    vehicle.speed = Number(speed) || 0;
    vehicle.status = 'Live';
    vehicle.lastUpdated = new Date();
  }

  // Emit both event names to ensure app.js catches the updates
  io.emit('vehicleUpdated', vehicle);
  io.emit('updateVehicles', vehicles);

  res.json({ success: true, message: "Location updated successfully", vehicle });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});