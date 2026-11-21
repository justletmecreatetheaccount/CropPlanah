// Solvine Commons // app.js
// one page, no framework. data comes from data.json.

/* ============ load data ============ */

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

/* ============ map + overlays ============ */

let map = null;
let currentLayer = null;
let overlays = null;

function initMap(config, overlayData) {
  overlays = overlayData;

  map = L.map("map", { preferCanvas: true }).setView(config.center, config.zoom);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  document.querySelectorAll(".overlay-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".overlay-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      setOverlay(btn.dataset.overlay);
    });
  });

  setOverlay("none");
}

function stationPopup(s, label, value, unit) {
  return `<div class="station-popup"><strong>${s.name}</strong><br>
    <span class="val">${value} ${unit}</span> ${label}<br>
    ${s.lat.toFixed(3)}, ${s.lng.toFixed(3)}</div>`;
}

function setOverlay(name) {
  if (currentLayer) { map.removeLayer(currentLayer); currentLayer = null; }
  if (name === "none" || !overlays[name]) return;

  const layer = L.layerGroup();

  if (name === "rain") {
    overlays.rain.stations.forEach((s) => {
      L.circleMarker([s.lat, s.lng], {
        radius: 6 + s.value * 5,
        color: "#4a8db0", weight: 1.5, fillColor: "#4a8db0", fillOpacity: 0.45,
      }).bindPopup(stationPopup(s, "rain", s.value, overlays.rain.unit)).addTo(layer);
    });
  }

  if (name === "temperature") {
    overlays.temperature.stations.forEach((s) => {
      L.circleMarker([s.lat, s.lng], {
        radius: 14,
        color: tempColor(s.value), weight: 1.5, fillColor: tempColor(s.value), fillOpacity: 0.45,
      }).bindPopup(stationPopup(s, "temperature", s.value, overlays.temperature.unit)).addTo(layer);
    });
  }

  if (name === "wind") {
    overlays.wind.stations.forEach((s) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="wind-arrow" style="transform: rotate(${s.direction}deg)">&#10148;</div>`,
        iconSize: [24, 24], iconAnchor: [12, 12],
      });
      L.marker([s.lat, s.lng], { icon })
        .bindPopup(`<div class="station-popup"><strong>${s.name}</strong><br>
          <span class="val">${s.speed} ${overlays.wind.unit}</span> from ${s.direction}&deg;</div>`)
        .addTo(layer);
    });
  }

  if (name === "diseases") {
    const colors = { high: "#a65638", medium: "#dfb548", low: "#5a7432" };
    overlays.diseases.outbreaks.forEach((o) => {
      const c = colors[o.severity] || "#4a8db0";
      L.circle([o.lat, o.lng], {
        radius: o.radius_m, color: c, weight: 1, dashArray: "4 6",
        fillColor: c, fillOpacity: 0.15,
      }).bindPopup(`<div class="station-popup"><strong>${o.name}</strong> <em>(${o.latin})</em><br>
        severity: ${o.severity}<br>crops: ${o.crops.join(", ")}</div>`).addTo(layer);
      L.circleMarker([o.lat, o.lng], {
        radius: 5, color: c, fillColor: "#f8f6f0", fillOpacity: 1, weight: 2,
      }).bindTooltip(`${o.name} (${o.severity})`).addTo(layer);
    });
  }

  layer.addTo(map);
  currentLayer = layer;
}

// cold sky to warm rust
function tempColor(t) {
  const k = Math.min(Math.max((t - 5) / 8, 0), 1);
  return `rgb(${Math.round(74 + k * 92)},${Math.round(141 - k * 55)},${Math.round(176 - k * 120)})`;
}

/* ============ warnings ============ */

function renderWarnings(warnings) {
  const list = document.getElementById("warnings");
  list.innerHTML = "";
  warnings.forEach((w) => {
    const li = document.createElement("li");
    li.className = `warning risk-${w.risk}`;
    li.innerHTML = `
      <span class="risk r-${w.risk}">${w.risk} risk</span>
      <p class="msg">warning issued at ${w.issued_at}, <strong>${w.disease}</strong>
        will probably hit your ${w.crop} crops according to the
        <strong>${w.model}</strong> prediction model</p>
      <p class="note">${w.note}</p>
      <p class="meta">${w.latin} // mesh signal ${w.id}</p>`;
    list.appendChild(li);
  });
}

/* ============ trading ledger ============ */

function initLedger(trades) {
  const entries = trades.entries;
  const slider = document.getElementById("ledger-slider");
  slider.max = String(entries.length - 1);

  const entryBox = document.getElementById("ledger-entry");
  const positionLabel = document.getElementById("ledger-position");
  const balanceBar = document.getElementById("balance-bar");
  const readout = document.getElementById("balance-readout");

  const maxAbs = Math.max(...entries.map((e) => Math.abs(e.balance)), 1);

  const sideList = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

  function render(index) {
    const e = entries[index];
    entryBox.innerHTML = `
      <div class="ledger-col gave"><h3>we traded</h3>${sideList(e.gave)}</div>
      <div class="ledger-arrows">&#8646;</div>
      <div class="ledger-col got"><h3>we got</h3>${sideList(e.got)}</div>`;
    positionLabel.textContent = `entry ${index + 1} of ${entries.length} // ${e.period}`;

    // running balance up to this entry
    const running = entries.slice(0, index + 1).reduce((sum, x) => sum + x.balance, 0);
    const positive = running >= 0;
    const magnitude = (Math.abs(running) / maxAbs) * 48;

    balanceBar.classList.toggle("negative", !positive);
    if (positive) {
      balanceBar.style.left = "50%";
      balanceBar.style.width = `${magnitude}%`;
    } else {
      balanceBar.style.left = `${50 - magnitude}%`;
      balanceBar.style.width = `${magnitude}%`;
    }

    readout.className = `balance-readout ${positive ? "positive" : "negative"}`;
    readout.innerHTML = `balance after this trade:
      <span class="sign">${positive ? "+" : ""}${running} ${trades.unit}</span>
      ${positive ? "(the commons is up)" : "(the commons is down)"}`;

    slider.value = String(index);
  }

  slider.addEventListener("input", () => render(Number(slider.value)));
  render(entries.length - 1);
}

/* ============ profile ============ */

function initProfile(profile) {
  const dialog = document.getElementById("profile-card");
  const btn = document.getElementById("btn-profile");

  dialog.innerHTML = `
    <h3 class="profile-name">${profile.name}</h3>
    <p class="profile-role">${profile.role}</p>
    <ul class="profile-facts">
      <li><span class="k">plot:</span> ${profile.plot}</li>
      <li><span class="k">energy credits:</span> <span class="profile-credits">+${profile.energy_credits} Wh banked</span></li>
      <li><span class="k">member since:</span> ${profile.member_since}</li>
      <li><span class="k">skills:</span> ${profile.skills.join(", ")}</li>
    </ul>`;

  btn.addEventListener("click", () => (dialog.open ? dialog.close() : dialog.showModal()));
  dialog.addEventListener("click", (ev) => { if (ev.target === dialog) dialog.close(); });
}

/* ============ entry point ============ */

async function main() {
  try {
    const data = await fetchJson("data.json");
    initMap(data.map, data.overlays);
    renderWarnings(data.warnings);
    initLedger(data.trades);
    initProfile(data.profile);
  } catch (err) {
    document.getElementById("warnings").innerHTML =
      `<li>data unreachable: ${err.message}. serve this folder with
       <code>python3 -m http.server</code> instead of opening the file directly.</li>`;
  }
}

main();
