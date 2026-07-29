// Initialize Socket.io connection
const socket = io();

// Map & Marker Storage
let map;
let markers = {};
let sourceMarker = null;
let sourceLatLng = null;

// Initialize Leaflet Map safely when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  fetchInitialUsers();
});

function initMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  map = L.map('map').setView([12.9716, 77.5946], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 300);
}

// Fetch existing active users on startup
async function fetchInitialUsers() {
  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    if (Array.isArray(users)) {
      renderUserList(users);
    }
  } catch (err) {
    console.error('Error fetching initial users:', err);
  }
}

// Calculate distance in kilometers using Haversine formula
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 1. WHATSAPP LINK GENERATOR
window.sendWhatsAppLink = function() {
  const phoneInput = document.getElementById('whatsappPhone');
  const rawPhone = phoneInput ? phoneInput.value.trim() : '';

  if (!rawPhone) {
    alert("Please enter a phone number.");
    return;
  }

  const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

  if (cleanPhone.length < 10) {
    alert("Please enter a valid phone number including country code (e.g. 916363167312).");
    return;
  }

  const liveHost = window.location.origin;
  const trackingUrl = `${liveHost}/driver.html?phone=${cleanPhone}`;
  const message = `Hello! Please click this link to enable live location tracking:\n${trackingUrl}`;
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  window.open(whatsappUrl, '_blank');
};

// 2. SET SOURCE LOCATION
window.setSourceFromCurrentLocation = function() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  const statusText = document.getElementById('sourceStatus');
  if (statusText) statusText.innerText = 'Locating...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      sourceLatLng = [latitude, longitude];

      if (sourceMarker) {
        sourceMarker.setLatLng(sourceLatLng);
      } else {
        sourceMarker = L.marker(sourceLatLng).addTo(map).bindPopup('<b>Your Location (Source)</b>');
      }

      map.setView(sourceLatLng, 14);
      if (statusText) statusText.innerText = `Source: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

      // Refresh distances on all existing user cards
      fetchInitialUsers();
    },
    (err) => {
      alert('Could not fetch location. Please grant GPS permissions.');
      if (statusText) statusText.innerText = 'Source: Permission Denied';
    }
  );
};

// 3. DRIVER FOCUS
window.focusOnDriver = function(lat, lng) {
  if (map) {
    map.setView([lat, lng], 15);
  }
};

// Socket Listeners
socket.on('updateUsers', (users) => {
  if (Array.isArray(users)) renderUserList(users);
});

socket.on('userUpdated', (user) => {
  if (user) renderSingleUser(user);
});

function renderUserList(users) {
  users.forEach(user => renderSingleUser(user));
}

function renderSingleUser(user) {
  const { phone, identifier, name, lat, lng } = user;
  if (lat === undefined || lng === undefined) return;

  // Use unique key for markers dictionary
  const key = phone || identifier;

  if (markers[key]) {
    markers[key].setLatLng([lat, lng]);
    markers[key].getPopup().setContent(`<b>${name}</b><br>Phone: ${phone || 'N/A'}`);
  } else if (map) {
    markers[key] = L.marker([lat, lng])
      .addTo(map)
      .bindPopup(`<b>${name}</b><br>Phone: ${phone || 'N/A'}`);
  }

  updateSidebarCard(user);
}

function updateSidebarCard(user) {
  const userList = document.getElementById('userList');
  if (!userList) return;

  const cardKey = user.phone || user.identifier;
  const cardId = `user-card-${cardKey}`;
  let existingCard = document.getElementById(cardId);

  if (!existingCard) {
    existingCard = document.createElement('div');
    existingCard.id = cardId;
    existingCard.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-2';
    userList.appendChild(existingCard);
  }

  const isOnline = user.status === 'Active';
  const badgeColor = isOnline 
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
    : 'bg-slate-500/10 text-slate-400 border-slate-500/20';

  // Distance calculation relative to Source Location
  let distanceText = 'Source not set';
  if (sourceLatLng) {
    const dist = calculateDistanceKm(sourceLatLng[0], sourceLatLng[1], user.lat, user.lng);
    distanceText = `📏 ${dist < 1 ? (dist * 1000).toFixed(0) + ' m' : dist.toFixed(2) + ' km'} away`;
  }

  // Battery percentage readout logic
  let batteryDisplay = '';
  if (user.batteryLevel !== undefined && user.batteryLevel !== null) {
    batteryDisplay = `🔋 ${user.batteryLevel}% ${user.isCharging ? '⚡' : ''}`;
  } else {
    batteryDisplay = `🔋 N/A`;
  }

  existingCard.innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        <h3 class="font-bold text-sm text-indigo-400">${user.name || 'User'}</h3>
        <p class="text-xs text-slate-400">📱 ${user.phone || 'N/A'}</p>
      </div>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${badgeColor}">
        ${user.status || 'Active'}
      </span>
    </div>
    <div class="flex justify-between items-center text-[11px] font-mono">
      <span class="text-emerald-400 font-semibold">${distanceText}</span>
      <span class="text-slate-300 font-medium">${batteryDisplay}</span>
    </div>
    <div class="text-[11px] font-mono text-slate-400">
      Lat: ${Number(user.lat).toFixed(4)}, Lng: ${Number(user.lng).toFixed(4)}
    </div>
    <button 
      onclick="focusOnDriver(${user.lat}, ${user.lng})"
      class="w-full bg-slate-700 hover:bg-slate-600 text-xs text-white py-1.5 rounded transition">
      📍 Focus on Map
    </button>
  `;
}