const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Enable CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());
app.use(express.static('public'));

// Attach io instance to request context
app.use((req, res, next) => {
  req.io = io;
  next();
});

// In-memory users storage
let users = [];

// GET endpoint for dashboard/admin initialization
app.get('/api/users', (req, res) => {
  res.json(users);
});

// POST endpoint targeted by driver/user tracking page
app.post('/api/user/update-location', (req, res) => {
  const { identifier, lat, lng, speed, batteryLevel, isCharging } = req.body;

  if (!identifier || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Clean phone / identifier string
  const phone = String(identifier).replace(/[^0-9]/g, '') || String(identifier);
  const suffix = phone.length >= 4 ? phone.slice(-4) : phone;

  let user = users.find(u => u.phone === phone || u.identifier === identifier);

  if (!user) {
    user = {
      id: `USER-${suffix}`,
      name: `User ${suffix}`,
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
    console.log(`New user registered: ${phone}`);
  } else {
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

// WebSocket Connection Events
io.on('connection', (socket) => {
  console.log(`Socket client connected: ${socket.id}`);
  
  // Send initial list of users immediately on connect
  socket.emit('updateUsers', users);

  socket.on('disconnect', () => {
    console.log(`Socket client disconnected: ${socket.id}`);
  });
});

// =========================================================
// WATCHDOG TIMER: Detect Switched Off / Disconnected Devices
// Runs every 5 seconds to mark inactive users as "Offline"
// =========================================================
setInterval(() => {
  const now = new Date();
  let statusChanged = false;

  users.forEach(user => {
    if (user.lastUpdated) {
      const secondsSinceLastUpdate = (now - new Date(user.lastUpdated)) / 1000;
      
      // If no updates received for > 20 seconds, mark device as Offline
      if (secondsSinceLastUpdate > 60 && user.status !== 'Offline') {
        user.status = 'Offline';
        statusChanged = true;
        console.log(`User ${user.phone} marked Offline (No signal for >20s)`);
      }
    }
  });

  // Emit updated list if any user went offline
  if (statusChanged) {
    io.emit('updateUsers', users);
  }
}, 5000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});