const socket = io();

let map;
let markers = {};
let currentUsers = [];

function initMap() {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  // Initialize Leaflet Map
  map = L.map('map').setView([12.9716, 77.5946], 12);

  // Load OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  fetchUsers();
}

function fetchUsers() {
  fetch('/api/users')
    .then(res => res.json())
    .then(data => {
      console.log("Fetched users:", data);
      currentUsers = data;
      renderUserList(data);
      updateMarkers(data);
    })
    .catch(err => console.error("Error fetching users:", err));
}

// Socket Listeners
socket.on('updateUsers', (users) => {
  console.log("Received updateUsers:", users);
  currentUsers = users;
  renderUserList(users);
  updateMarkers(users);
});

socket.on('userUpdated', (user) => {
  console.log("Received single user update:", user);
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
          ${isOffline ? 'Offline / Switched Off' : 'Active'}
        </span>
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
    const isLowBattery = hasBattery && u.batteryLevel <= 50;

    let cardStyle = 'bg-slate-800/80 border-slate-700/60 hover:border-indigo-500';
    if (isOffline) {
      cardStyle = 'bg-rose-950/30 border-rose-600/80 hover:border-rose-500';
    } else if (isLowBattery) {
      cardStyle = 'bg-amber-950/20 border-amber-500/80 hover:border-amber-400';
    }

    return `
      <div 
        onclick="focusUser('${uKey}')"
        class="p-4 border rounded-xl cursor-pointer transition space-y-2 ${cardStyle}"
      >
        <div class="flex justify-between items-start">
          <h3 class="font-bold text-white">${u.name || 'User ' + uKey}</h3>
          
          <div class="flex items-center gap-1.5">
            ${hasBattery ? `
              <span class="px-2 py-0.5 text-xs rounded-full font-mono font-semibold ${
                isLowBattery 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' 
                  : 'bg-slate-700/80 text-slate-300 border border-slate-600'
              }">
                ${u.batteryLevel}% ${u.isCharging ? '⚡' : '🔋'}
              </span>
            ` : ''}

            <span class="px-2 py-0.5 text-xs rounded-full ${
              isOffline 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold' 
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }">
              ${isOffline ? 'Offline' : 'Active'}
            </span>
          </div>
        </div>

        <p class="text-xs text-slate-400">User ID: <span class="text-slate-200 font-mono">${u.id || 'N/A'}</span></p>
        <p class="text-xs text-slate-400">Phone: <span class="text-slate-200 font-mono">${u.phone || 'N/A'}</span></p>

        ${isOffline ? `
          <div class="text-[11px] text-rose-400 font-semibold bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 flex items-center gap-1.5">
            <span>❌</span> Device Disconnected / Switched Off
          </div>
        ` : isLowBattery ? `
          <div class="text-[11px] text-amber-400 font-semibold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 flex items-center gap-1.5 animate-pulse">
            <span>⚠️</span> Low Battery Alert (${u.batteryLevel}%)
          </div>
        ` : ''}

        <div class="text-xs text-indigo-400 font-mono pt-1">${Number(u.lat).toFixed(4)}, ${Number(u.lng).toFixed(4)}</div>
      </div>
    `;
  }).join('');
}

function focusUser(id) {
  const user = currentUsers.find(u => (u.id === id || u.phone === id));
  if (user && map) {
    map.setView([Number(user.lat), Number(user.lng)], 15);
    if (markers[id]) {
      markers[id].openPopup();
    }
  }
}

window.searchUser = function() {
  const query = document.getElementById("searchInput")?.value.trim().replace(/[^0-9]/g, '');
  if (!query) return;

  const user = currentUsers.find(u => {
    const uPhone = (u.phone || u.identifier || '').replace(/[^0-9]/g, '');
    const uId = (u.id || '').toLowerCase();
    return (uPhone && (uPhone.endsWith(query) || query.endsWith(uPhone))) || uId.includes(query);
  });

  if (user) {
    focusUser(user.id || user.phone);
  } else {
    alert("No matching user or phone number found!");
  }
};

window.addEventListener('DOMContentLoaded', initMap);