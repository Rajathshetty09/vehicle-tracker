const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Explicitly serve public/index.html when visiting http://localhost:3000/
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// In-memory array to hold active users
let users = [];

// GET endpoint to fetch all active users
app.get('/api/users', (req, res) => {
  res.json(users);
});

// POST endpoint targeted by driver/user tracking page
app.post('/api/user/update-location', (req, res) => {
  const { identifier, name, lat, lng, speed, batteryLevel, isCharging } = req.body;

  if (!identifier || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const phone = String(identifier).replace(/[^0-9]/g, '') || String(identifier);
  const suffix = phone.length >= 4 ? phone.slice(-4) : phone;

  let user = users.find(u => u.phone === phone || u.identifier === identifier);

  if (!user) {
    user = {
      id: `USER-${suffix}`,
      name: name && name.trim() ? name.trim() : `User ${suffix}`,
      phone: phone,
      identifier: identifier,
      lat: Number(lat),
      lng: Number(lng),
      speed: Number(speed) || 0,
      batteryLevel: batteryLevel !== undefined && batteryLevel !== null ? Number(batteryLevel) : null,
      isCharging: isCharging !== undefined ? Boolean(isCharging) : false,
      status: 'Active',
      lastUpdated: new Date()
    };
    users.push(user);
    console.log(`New user registered: ${user.name} (${phone})`);
  } else {
    if (name && name.trim()) user.name = name.trim();
    user.lat = Number(lat);
    user.lng = Number(lng);
    user.speed = Number(speed) || 0;
    user.batteryLevel = batteryLevel !== undefined && batteryLevel !== null ? Number(batteryLevel) : user.batteryLevel;
    user.isCharging = isCharging !== undefined ? Boolean(isCharging) : user.isCharging;
    user.status = 'Active';
    user.lastUpdated = new Date();
  }

  // Broadcast updates to dashboard clients
  io.emit('userUpdated', user);
  io.emit('updateUsers', users);

  res.json({ success: true, message: "Location updated successfully", user });
});

// Watchdog timer: Mark user as offline if no update for > 60 seconds
setInterval(() => {
  const now = new Date();
  let statusChanged = false;

  users.forEach(user => {
    const secondsSinceLastUpdate = (now - new Date(user.lastUpdated)) / 1000;
    if (secondsSinceLastUpdate > 60 && user.status !== 'Offline') {
      user.status = 'Offline';
      statusChanged = true;
      console.log(`User ${user.name} (${user.phone}) marked Offline (No signal for >60s)`);
    }
  });

  if (statusChanged) {
    io.emit('updateUsers', users);
  }
}, 5000);

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Dashboard client connected:', socket.id);
  socket.emit('updateUsers', users);

  socket.on('disconnect', () => {
    console.log('Dashboard client disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});