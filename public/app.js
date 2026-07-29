const socket = io();

let map;
let markers = {};
let currentUsers = [];
let sourceLocation = null;
let sourceMarker = null;
let routingControl = null;

function initMap() {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  map = L.map('map').setView([12.9716, 77.5946], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  fetchUsers();
}

function setSourceFromCurrentLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      sourceLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      
      const sourceStatus = document.getElementById('sourceStatus');
      if (sourceStatus) {
        sourceStatus.innerText = `Source: ${sourceLocation.lat.toFixed(4)}, ${sourceLocation.lng.toFixed(4)}`;
      }

      if (sourceMarker) {
        sourceMarker.setLatLng([sourceLocation.lat, sourceLocation.lng]);
      } else {
        sourceMarker = L.marker([sourceLocation.lat, sourceLocation.lng], {
          title: "Source (My Position)"
        }).addTo(map).bindPopup("<b>Source Location (You)</b>").openPopup();
      }

      map.setView([sourceLocation.lat, sourceLocation.lng], 13);
    },
    (err) => {
      alert("Unable to retrieve your current location: " + err.message);
    }
  );
}

function fetchUsers() {
  fetch('/api/users')
    .then(res => res.json())
    .then(data => {
      currentUsers = data;
      renderUserList(data);
      updateMarkers(data);
    })
    .catch(err => console.error("Error fetching users:", err));
}

socket.on('updateUsers', (users) => {
  currentUsers = users;
  renderUserList(users);
  updateMarkers(users);
});

socket.on('userUpdated', () => {
  fetchUsers();
});

function updateMarkers(users) {
  if (!map || !Array.isArray(users)) return;

  users.forEach(user => {
    const userKey = user.id || user.phone;
    if (!userKey) return;

    const lat = Number(user.lat);
    const lng = Number(user.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    const isOffline = user.status === 'Offline';
    const batteryText = user.batteryLevel !== null && user.batteryLevel !== undefined 
      ? `${user.batteryLevel}% ${user.isCharging ? '⚡' : '🔋'}` 
      : 'N/A';

    const infoContent = `
      <div style="color: #000; padding: 4px; font-family: sans-serif;">
        <strong>${user.name || 'User ' + userKey}</strong><br/>
        ID: ${user.id || 'N/A'}<br/>
        Phone: ${user.phone || 'N/A'}<br/>
        Speed: ${Math.round(user.speed || 0)} km/h<br/>
        Battery: <strong>${batteryText}</strong><br/>
        Status: <span style="color: ${isOffline ? '#dc2626' : '#059669'}; font-weight: bold;">
          ${isOffline ? 'Offline' : 'Active'}
        </span><br/>
        <button onclick="calculateRouteToUser('${userKey}')" style="margin-top:6px; background:#4f46e5; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
          Get Route & Distance
        </button>
      </div>
    `;

    if (markers[userKey]) {
      markers[userKey].setLatLng([lat, lng]);
      markers[userKey].getPopup().setContent(infoContent);
    } else {
      const marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup(infoContent);
      markers[userKey] = marker;
    }
  });
}

function renderUserList(users) {
  const listEl = document.getElementById("userList");
  if (!listEl || !Array.isArray(users)) return;

  if (users.length === 0) {
    listEl.innerHTML = `<p class="text-xs text-slate-400 p-2">No active users broadcasting yet.</p>`;
    return;
  }

  listEl.innerHTML = users.map(u => {
    const uKey = u.id || u.phone;
    const isOffline = u.status === 'Offline';
    const hasBattery = u.batteryLevel !== null && u.batteryLevel !== undefined;

    return `
      <div 
        onclick="focusUser('${uKey}')"
        class="p-4 border rounded-xl cursor-pointer transition space-y-2 bg-slate-800/80 border-slate-700/60 hover:border-indigo-500"
      >
        <div class="flex justify-between items-start">
          <h3 class="font-bold text-white">${u.name || 'User ' + uKey}</h3>
          
          <div class="flex items-center gap-1.5">
            ${hasBattery ? `
              <span class="px-2 py-0.5 text-xs rounded-full font-mono font-semibold bg-slate-700/80 text-slate-300 border border-slate-600">
                ${u.batteryLevel}% ${u.isCharging ? '⚡' : '🔋'}
              </span>
            ` : ''}

            <span class="px-2 py-0.5 text-xs rounded-full ${
              isOffline ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }">
              ${isOffline ? 'Offline' : 'Active'}
            </span>
          </div>
        </div>

        <p class="text-xs text-slate-400">User ID: <span class="text-slate-200 font-mono">${u.id || 'N/A'}</span></p>
        <p class="text-xs text-slate-400">Phone: <span class="text-slate-200 font-mono">${u.phone || 'N/A'}</span></p>

        <button 
          onclick="event.stopPropagation(); calculateRouteToUser('${uKey}')" 
          class="w-full mt-2 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs py-1.5 rounded-lg font-semibold transition">
          🗺️ Calculate Route & Distance
        </button>
      </div>
    `;
  }).join('');
}

function calculateRouteToUser(userKey) {
  const user = currentUsers.find(u => (u.id === userKey || u.phone === userKey));
  
  if (!user) {
    alert("User location not found!");
    return;
  }

  if (!sourceLocation) {
    alert("Please click 'Use My Current Location as Source' first!");
    return;
  }

  // Remove existing route if drawn
  if (routingControl) {
    map.removeControl(routingControl);
  }

  // Draw driving route using Leaflet Routing Machine
  routingControl = L.Routing.control({
    waypoints: [
      L.latLng(sourceLocation.lat, sourceLocation.lng),
      L.latLng(Number(user.lat), Number(user.lng))
    ],
    routeWhileDragging: false,
    addWaypoints: false,
    show: false // Hide default instructions box
  }).addTo(map);

  routingControl.on('routesfound', function(e) {
    const routes = e.routes;
    const summary = routes[0].summary;

    const distanceKm = (summary.totalDistance / 1000).toFixed(2);
    const timeMin = Math.round(summary.totalTime / 60);

    const routePanel = document.getElementById('routeDetails');
    const routeDistance = document.getElementById('routeDistance');
    const routeTime = document.getElementById('routeTime');

    if (routePanel && routeDistance && routeTime) {
      routePanel.classList.remove('hidden');
      routeDistance.innerText = `${distanceKm} km`;
      routeTime.innerText = `${timeMin} mins`;
    }
  });
}

function focusUser(id) {
  const user = currentUsers.find(u => (u.id === id || u.phone === id));
  if (user && map) {
    map.setView([Number(user.lat), Number(user.lng)], 15);
    if (markers[id]) markers[id].openPopup();
  }
}

window.searchUser = function() {
  const query = document.getElementById("searchInput")?.value.trim().toLowerCase();
  if (!query) return;

  const user = currentUsers.find(u => {
    const uName = (u.name || '').toLowerCase();
    const uPhone = (u.phone || '').toLowerCase();
    const uId = (u.id || '').toLowerCase();
    return uName.includes(query) || uPhone.includes(query) || uId.includes(query);
  });

  if (user) {
    focusUser(user.id || user.phone);
  } else {
    alert("No matching user found!");
  }
};

window.addEventListener('DOMContentLoaded', initMap);