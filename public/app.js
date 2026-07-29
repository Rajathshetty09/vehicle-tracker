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
});

function initMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  // Initialize map centered on Bengaluru default (lat, lng, zoom)
  map = L.map('map').setView([12.9716, 77.5946], 12);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Recalculate dimensions so tiles render immediately
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 300);
}

// 1. WHATSAPP LINK GENERATOR (EXPOSED TO WINDOW)
window.sendWhatsAppLink = function() {
  const phoneInput = document.getElementById('whatsappPhone');
  const rawPhone = phoneInput ? phoneInput.value.trim() : '';

  if (!rawPhone) {
    alert("Please enter a phone number.");
    return;
  }

  // Remove spaces, pluses, dashes
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

  if (cleanPhone.length < 10) {
    alert("Please enter a valid phone number including country code (e.g. 916363167312).");
    return;
  }

  // Automatically use current live domain (Render URL or localhost)
  const liveHost = window.location.origin;
  const trackingUrl = `${liveHost}/driver.html?phone=${cleanPhone}`;

  const message = `Hello! Please click this link to enable live location tracking:\n${trackingUrl}`;
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  window.open(whatsappUrl, '_blank');
};

// 2. SET SOURCE LOCATION (EXPOSED TO WINDOW)
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
    },
    (err) => {
      alert('Could not fetch location. Please grant GPS permissions.');
      if (statusText) statusText.innerText = 'Source: Permission Denied';
    }
  );
};

// 3. DRIVER FOCUS (EXPOSED TO WINDOW)
window.focusOnDriver = function(lat, lng) {
  if (map) {
    map.setView([lat, lng], 15);
  }
};

// Handle incoming location updates from drivers
socket.on('locationUpdate', (data) => {
  console.log('Location update received:', data);
  if (!data || !data.id) return;

  const { id, name, phone, lat, lng } = data;

  // Update or create Map Marker
  if (markers[id]) {
    markers[id].setLatLng([lat, lng]);
  } else {
    markers[id] = L.marker([lat, lng])
      .addTo(map)
      .bindPopup(`<b>${name || 'Driver'}</b><br>Phone: ${phone || 'N/A'}`);
  }

  // Pan map to driver location
  map.panTo([lat, lng]);

  // Update Left Sidebar UI
  updateSidebarCard(id, name, phone, lat, lng);
});

// Update Sidebar Cards
function updateSidebarCard(id, name, phone, lat, lng) {
  const userList = document.getElementById('userList');
  if (!userList) return;

  let existingCard = document.getElementById(`user-card-${id}`);

  if (!existingCard) {
    existingCard = document.createElement('div');
    existingCard.id = `user-card-${id}`;
    existingCard.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-2';
    userList.appendChild(existingCard);
  }

  existingCard.innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        <h3 class="font-bold text-sm text-indigo-400">${name || 'Active Driver'}</h3>
        <p class="text-xs text-slate-400">📱 ${phone || 'N/A'}</p>
      </div>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        Live
      </span>
    </div>
    <div class="text-[11px] font-mono text-slate-400">
      Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}
    </div>
    <button 
      onclick="focusOnDriver(${lat}, ${lng})"
      class="w-full bg-slate-700 hover:bg-slate-600 text-xs text-white py-1.5 rounded transition">
      📍 Focus on Map
    </button>
  `;
}