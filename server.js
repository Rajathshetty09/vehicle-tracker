// Express middleware to parse JSON bodies
app.use(express.json());

// In-memory array or database collection for vehicles
let vehicles = [
  // Default/Initial vehicles can stay here
];

// POST endpoint targeted by driver.html
app.post('/api/driver/update-location', (req, res) => {
  const { identifier, lat, lng, speed } = req.body;

  if (!identifier || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Clean the identifier (remove spaces/dashes)
  const phone = identifier.replace(/[^0-9]/g, '');

  // 1. Look for existing driver/vehicle in the array
  let vehicle = vehicles.find(v => v.phone === phone || v.identifier === phone);

  // 2. IF NOT FOUND: Auto-register the new driver on the fly!
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
    console.log(`New driver auto-registered: ${phone}`);
  } else {
    // 3. IF FOUND: Update their live location
    vehicle.lat = Number(lat);
    vehicle.lng = Number(lng);
    vehicle.speed = Number(speed) || 0;
    vehicle.status = 'Live';
    vehicle.lastUpdated = new Date();
  }

  // 4. Broadcast live update to all active web dashboards via Socket.io
  if (req.io) {
    req.io.emit('vehicleUpdated', vehicle);
    req.io.emit('updateVehicles', vehicles);
  } else if (typeof io !== 'undefined') {
    io.emit('vehicleUpdated', vehicle);
    io.emit('updateVehicles', vehicles);
  }

  // Respond back to driver.html
  res.json({ success: true, message: "Location updated successfully", vehicle });
});