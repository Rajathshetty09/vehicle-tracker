const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
  req.io = io;
  next();
});

// In-memory users storage
let users = [];

// GET endpoint for dashboard
app.get('/api/users', (req, res) => {
  res.json(users);
});

// POST endpoint targeted by driver/user tracking page
app.post('/api/user/update-location', (req, res) => {
  const { identifier, lat, lng, speed, batteryLevel, isCharging } = req.body;

  if (!identifier || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const phone = identifier.replace(/[^0-9]/g, '');

  let user = users.find(u => u.phone === phone || u.identifier === phone);

  if (!user) {
    user = {
      id: `USER-${phone.slice(-4)}`,
      name: `User ${phone.slice(-4)}`,
      phone: phone,
      identifier: phone,
      lat: Number(lat),
      lng: Number(lng),
      speed: Number(speed) || 0,
      batteryLevel: batteryLevel !== undefined ? Number(batteryLevel) : null,
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
    user.batteryLevel = batteryLevel !== undefined ? Number(batteryLevel) : user.batteryLevel;
    user.isCharging = isCharging !== undefined ? Boolean(isCharging) : user.isCharging;
    user.status = 'Active';
    user.lastUpdated = new Date();
  }

  // Broadcast updates to dashboard clients
  io.emit('userUpdated', user);
  io.emit('updateUsers', users);

  res.json({ success: true, message: "Location updated successfully", user });
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
      if (secondsSinceLastUpdate > 20 && user.status !== 'Offline') {
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