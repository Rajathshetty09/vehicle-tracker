// POST endpoint targeted by driver/user tracking page
app.post('/api/user/update-location', (req, res) => {
  const { identifier, name, lat, lng, speed, batteryLevel, isCharging } = req.body;

  if (!identifier || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Clean phone/identifier string
  const phone = String(identifier).replace(/[^0-9]/g, '') || String(identifier);
  const suffix = phone.length >= 4 ? phone.slice(-4) : phone;

  // Find user STRICTLY by unique phone/identifier
  let user = users.find(u => u.phone === phone || u.identifier === identifier);

  if (!user) {
    user = {
      id: `USER-${phone}`, // Unique string ID per phone number
      name: name && name.trim() ? name.trim() : `User ${suffix}`,
      phone: phone,
      identifier: identifier,
      lat: Number(lat),
      lng: Number(lng),
      speed: Number(speed) || 0,
      batteryLevel: batteryLevel !== undefined && batteryLevel !== null ? Number(batteryLevel) : null,
      isCharging: Boolean(isCharging),
      status: 'Active',
      lastUpdated: new Date()
    };
    users.push(user);
    console.log(`New user registered: ${user.name} (${phone})`);
  } else {
    // Only update name if a valid string is passed (prevents overwriting Khushi with M)
    if (name && name.trim()) user.name = name.trim();
    user.lat = Number(lat);
    user.lng = Number(lng);
    user.speed = Number(speed) || 0;
    
    // Maintain or update battery level
    if (batteryLevel !== undefined && batteryLevel !== null) {
      user.batteryLevel = Number(batteryLevel);
    }
    user.isCharging = Boolean(isCharging);
    user.status = 'Active';
    user.lastUpdated = new Date();
  }

  // Broadcast updates to dashboard clients
  io.emit('userUpdated', user);
  io.emit('updateUsers', users);

  res.json({ success: true, message: "Location updated successfully", user });
});