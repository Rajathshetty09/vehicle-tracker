const socket = io();

let map;
let markers = {};
let currentVehicles = [];

function initMap() {
  // Center over Bengaluru
  const defaultCenter = { lat: 12.9716, lng: 77.5946 };
  
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: defaultCenter,
  });

  // Fetch initial data on page load
  fetchVehicles();
}

// Helper function to fetch all vehicles from server
function fetchVehicles() {
  fetch('/api/vehicles')
    .then(res => res.json())
    .then(data => {
      console.log("Fetched vehicles:", data);
      currentVehicles = data;
      renderVehicleList(data);
      updateMarkers(data);
    })
    .catch(err => console.error("Error fetching vehicles:", err));
}

// --- Live Socket Event Listeners ---

// 1. Listen for full list updates ('updateVehicles' or 'locationUpdate')
socket.on('updateVehicles', (vehicles) => {
  console.log("Received updateVehicles:", vehicles);
  currentVehicles = vehicles;
  renderVehicleList(vehicles);
  updateMarkers(vehicles);
});

socket.on('locationUpdate', (vehicles) => {
  console.log("Received locationUpdate:", vehicles);
  currentVehicles = vehicles;
  renderVehicleList(vehicles);
  updateMarkers(vehicles);
});

// 2. Listen for single driver updates ('vehicleUpdated')
socket.on('vehicleUpdated', (vehicle) => {
  console.log("Received single vehicle update:", vehicle);
  // Re-fetch full vehicle list from backend to keep dashboard synchronized
  fetchVehicles();
});

// --- Map & Sidebar Rendering ---

function updateMarkers(vehicles) {
  if (!map || !Array.isArray(vehicles)) return;

  vehicles.forEach(vehicle => {
    // Determine unique key (id, plate, or phone)
    const vehicleKey = vehicle.id || vehicle.plate || vehicle.phone;
    if (!vehicleKey) return;

    const pos = { lat: Number(vehicle.lat), lng: Number(vehicle.lng) };

    if (markers[vehicleKey]) {
      // Move existing marker smoothly
      markers[vehicleKey].setPosition(pos);
    } else {
      // Create a new marker on the map
      const marker = new google.maps.Marker({
        position: pos,
        map: map,
        title: `${vehicle.driver || vehicle.id || 'Driver'} (${vehicleKey})`,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="color: #000; padding: 4px;">
            <strong>${vehicle.driver || 'Driver (' + vehicleKey + ')'}</strong><br/>
            ID: ${vehicle.id || 'N/A'}<br/>
            Phone: ${vehicle.phone || vehicle.identifier || 'N/A'}<br/>
            Speed: ${Math.round(vehicle.speed || 0)} km/h
          </div>
        `
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });

      markers[vehicleKey] = marker;
    }
  });
}

function renderVehicleList(vehicles) {
  const listEl = document.getElementById("vehicleList");
  if (!listEl || !Array.isArray(vehicles)) return;

  if (vehicles.length === 0) {
    listEl.innerHTML = `<p class="text-xs text-slate-400 p-2">No active drivers broadcasting yet.</p>`;
    return;
  }

  listEl.innerHTML = vehicles.map(v => {
    const vKey = v.id || v.plate || v.phone;
    const isLive = v.status === 'Live' || v.status === 'Moving';
    
    return `
      <div 
        onclick="focusVehicle('${vKey}')"
        class="p-4 bg-slate-800/80 border border-slate-700/60 rounded-xl cursor-pointer hover:border-indigo-500 transition"
      >
        <div class="flex justify-between items-start mb-1">
          <h3 class="font-bold text-white">${v.driver || 'Driver (' + vKey + ')'}</h3>
          <span class="px-2 py-0.5 text-xs rounded-full ${isLive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
            ${v.status || 'Live'}
          </span>
        </div>
        <p class="text-xs text-slate-400 mb-1">ID: <span class="text-slate-200 font-mono">${v.id || 'N/A'}</span></p>
        <p class="text-xs text-slate-400">Phone: <span class="text-slate-200 font-mono">${v.phone || v.identifier || 'N/A'}</span></p>
        <div class="mt-2 text-xs text-indigo-400 font-mono">${Number(v.lat).toFixed(4)}, ${Number(v.lng).toFixed(4)}</div>
      </div>
    `;
  }).join('');
}

function focusVehicle(id) {
  const vehicle = currentVehicles.find(v => (v.id === id || v.plate === id || v.phone === id));
  if (vehicle && map) {
    map.panTo({ lat: Number(vehicle.lat), lng: Number(vehicle.lng) });
    map.setZoom(15);
  }
}

window.searchVehicle = function() {
  const query = document.getElementById("searchInput")?.value.trim().toLowerCase();
  if (!query) return;

  const vehicle = currentVehicles.find(v => 
    (v.id && v.id.toLowerCase().replace(/\s+/g, '') === query.replace(/\s+/g, '')) || 
    (v.phone && v.phone.includes(query)) ||
    (v.identifier && v.identifier.includes(query))
  );

  if (vehicle) {
    focusVehicle(vehicle.id || vehicle.plate || vehicle.phone);
  } else {
    alert("No matching vehicle or phone number found!");
  }
};

window.initMap = initMap;