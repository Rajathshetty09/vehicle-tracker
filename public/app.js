const socket = io();

let map;
let markers = {};
let currentUsers = [];

function initMap() {
  const defaultCenter = { lat: 12.9716, lng: 77.5946 };
  
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: defaultCenter,
  });

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

    const pos = { lat: Number(user.lat), lng: Number(user.lng) };

    if (markers[userKey]) {
      markers[userKey].setPosition(pos);
    } else {
      const marker = new google.maps.Marker({
        position: pos,
        map: map,
        title: `${user.name || user.id} (${userKey})`,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="color: #000; padding: 4px;">
            <strong>${user.name || 'User ' + userKey}</strong><br/>
            ID: ${user.id || 'N/A'}<br/>
            Phone: ${user.phone || 'N/A'}<br/>
            Speed: ${Math.round(user.speed || 0)} km/h
          </div>
        `
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });

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
    const isLive = u.status === 'Active' || u.status === 'Live';
    
    return `
      <div 
        onclick="focusUser('${uKey}')"
        class="p-4 bg-slate-800/80 border border-slate-700/60 rounded-xl cursor-pointer hover:border-indigo-500 transition"
      >
        <div class="flex justify-between items-start mb-1">
          <h3 class="font-bold text-white">${u.name || 'User ' + uKey}</h3>
          <span class="px-2 py-0.5 text-xs rounded-full ${isLive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
            ${u.status || 'Active'}
          </span>
        </div>
        <p class="text-xs text-slate-400 mb-1">User ID: <span class="text-slate-200 font-mono">${u.id || 'N/A'}</span></p>
        <p class="text-xs text-slate-400">Phone: <span class="text-slate-200 font-mono">${u.phone || 'N/A'}</span></p>
        <div class="mt-2 text-xs text-indigo-400 font-mono">${Number(u.lat).toFixed(4)}, ${Number(u.lng).toFixed(4)}</div>
      </div>
    `;
  }).join('');
}

function focusUser(id) {
  const user = currentUsers.find(u => (u.id === id || u.phone === id));
  if (user && map) {
    map.panTo({ lat: Number(user.lat), lng: Number(user.lng) });
    map.setZoom(15);
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

window.initMap = initMap;