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

  // Fetch initial data
  fetch('/api/vehicles')
    .then(res => res.json())
    .then(data => {
      console.log("Fetched initial vehicles:", data);
      currentVehicles = data;
      renderVehicleList(data);
      updateMarkers(data);
    })
    .catch(err => console.error("Error fetching vehicles:", err));
}

// Live update listener
socket.on('locationUpdate', (vehicles) => {
  currentVehicles = vehicles;
  renderVehicleList(vehicles);
  updateMarkers(vehicles);
});

function updateMarkers(vehicles) {
  if (!map) return;

  vehicles.forEach(vehicle => {
    const pos = { lat: vehicle.lat, lng: vehicle.lng };

    if (markers[vehicle.id]) {
      markers[vehicle.id].setPosition(pos);
    } else {
      const marker = new google.maps.Marker({
        position: pos,
        map: map,
        title: `${vehicle.driver} (${vehicle.id})`,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="color: #000; padding: 4px;">
            <strong>${vehicle.driver}</strong><br/>
            Plate: ${vehicle.id}<br/>
            Phone: ${vehicle.phone || 'N/A'}<br/>
            Speed: ${Math.round(vehicle.speed)} km/h
          </div>
        `
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });

      markers[vehicle.id] = marker;
    }
  });
}

function renderVehicleList(vehicles) {
  const listEl = document.getElementById("vehicleList");
  if (!listEl) return;

  listEl.innerHTML = vehicles.map(v => `
    <div 
      onclick="focusVehicle('${v.id}')"
      class="p-4 bg-slate-800/80 border border-slate-700/60 rounded-xl cursor-pointer hover:border-indigo-500 transition"
    >
      <div class="flex justify-between items-start mb-1">
        <h3 class="font-bold text-white">${v.driver}</h3>
        <span class="px-2 py-0.5 text-xs rounded-full ${v.status === 'Moving' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
          ${v.status}
        </span>
      </div>
      <p class="text-xs text-slate-400 mb-1">Plate: <span class="text-slate-200 font-mono">${v.id}</span></p>
      <p class="text-xs text-slate-400">Phone: <span class="text-slate-200 font-mono">${v.phone || 'N/A'}</span></p>
      <div class="mt-2 text-xs text-indigo-400 font-mono">${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}</div>
    </div>
  `).join('');
}

function focusVehicle(id) {
  const vehicle = currentVehicles.find(v => v.id === id);
  if (vehicle && map && markers[id]) {
    map.panTo({ lat: vehicle.lat, lng: vehicle.lng });
    map.setZoom(15);
  }
}

window.searchVehicle = function() {
  const query = document.getElementById("searchInput")?.value.trim().toLowerCase();
  if (!query) return;

  const vehicle = currentVehicles.find(v => 
    v.id.toLowerCase().replace(/\s+/g, '') === query.replace(/\s+/g, '') || 
    (v.phone && v.phone.includes(query))
  );

  if (vehicle) {
    focusVehicle(vehicle.id);
  } else {
    alert("No matching vehicle or phone number found!");
  }
};

window.initMap = initMap;