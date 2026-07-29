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