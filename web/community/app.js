const API_ITEMS_URL = "http://localhost:8000/api/items";
const API_CALENDAR_URL = "http://localhost:8000/api/calendar";
const USE_MOCK = true;

let stockItems = [];
let calendarEntries = [];
let primaryDeficitNutrient = null;

async function loadData() {
  if (USE_MOCK) {
    stockItems = [...MOCK_ITEMS];
    calendarEntries = MOCK_CALENDAR.map(entry => ({ ...entry }));
  } else {
    try {
      const [itemsRes, calRes] = await Promise.all([
        fetch(API_ITEMS_URL),
        fetch(API_CALENDAR_URL)
      ]);
      stockItems = await itemsRes.json();
      calendarEntries = await calRes.json();
    } catch (error) {
      console.error("Python server error:", error);
    }
  }

  populateFoodPresets();
  refreshAllViews();
}

function refreshAllViews() {
  renderCards(stockItems);
  calculateAndRenderNutrition(MOCK_COMMUNITY.members, stockItems);
  renderContributorsChart(stockItems);
  renderAlmanac(calendarEntries);
  populatePlannedCropsSelect();
}

/* =========================================
   REFERENCE FOOD LOOKUP (AUTO-FILL)
   ========================================= */
function populateFoodPresets() {
  const datalist = document.getElementById("food-presets");
  if (!datalist || typeof FOOD_DATABASE === "undefined") return;

  datalist.innerHTML = Object.keys(FOOD_DATABASE)
    .map(name => `<option value="${name}"></option>`)
    .join("");
}

function findFoodReference(cropName) {
  if (!cropName || typeof FOOD_DATABASE === "undefined") return null;
  const target = cropName.trim().toLowerCase();
  const matchKey = Object.keys(FOOD_DATABASE).find(k => k.toLowerCase() === target);
  return matchKey ? { name: matchKey, ...FOOD_DATABASE[matchKey] } : null;
}

/* =========================================
   01 / HARVEST CARDS
   ========================================= */
function renderCards(items) {
  const container = document.getElementById("cards-container");
  if (!container) return;

  container.innerHTML = items.map((item, index) => `
    <article class="harvest-card">
      <div>
        <div class="card-header">
          <span class="card-tag">${item.category}</span>
          <span class="card-meta">#${String(index + 1).padStart(2, "0")} • ${item.distance}</span>
        </div>

        <h3 class="card-title">${item.title}</h3>

        <div class="macros-table">
          <div class="macro-cell">
            <span class="macro-label">KCAL</span>
            <strong>${item.calories}</strong>
          </div>
          <div class="macro-cell">
            <span class="macro-label">PROT</span>
            <strong class="text-sage">${item.protein}g</strong>
          </div>
          <div class="macro-cell">
            <span class="macro-label">FATS</span>
            <strong class="text-rust">${item.fats}g</strong>
          </div>
          <div class="macro-cell">
            <span class="macro-label">CARBS</span>
            <strong>${item.carbs}g</strong>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <span>Producer: <strong>${item.author}</strong></span>
        <span class="status-dispo">Available</span>
      </div>
    </article>
  `).join("");
}

/* =========================================
   02 / NUTRITION & GAUGES
   ========================================= */
function renderSegmentedGauge(containerId, currentValue, totalValue, fillClass) {
  const totalSegments = 15;
  const ratio = totalValue > 0 ? currentValue / totalValue : 0;
  const activeSegments = Math.min(totalSegments, Math.round(ratio * totalSegments));

  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  for (let i = 0; i < totalSegments; i++) {
    const isFilled = i < activeSegments;
    const segmentClass = isFilled ? `gauge-segment ${fillClass}` : "gauge-segment";
    container.innerHTML += `<div class="${segmentClass}"></div>`;
  }
}

function calculateAndRenderNutrition(members, availableItems) {
  const reqCalories = members.reduce((acc, m) => acc + m.requiredCalories, 0);
  const reqProtein = members.reduce((acc, m) => acc + m.requiredProtein, 0);
  const reqFats = members.reduce((acc, m) => acc + m.requiredFats, 0);
  const reqCarbs = members.reduce((acc, m) => acc + m.requiredCarbs, 0);

  const availCalories = availableItems.reduce((acc, i) => acc + Number(i.calories || 0), 0);
  const availProtein = availableItems.reduce((acc, i) => acc + Number(i.protein || 0), 0);
  const availFats = availableItems.reduce((acc, i) => acc + Number(i.fats || 0), 0);
  const availCarbs = availableItems.reduce((acc, i) => acc + Number(i.carbs || 0), 0);

  document.getElementById("members-count-badge").textContent = `${members.length} members`;
  document.getElementById("total-calories").textContent = reqCalories.toLocaleString("en-US");
  document.getElementById("stock-calories").textContent = `${availCalories.toLocaleString("en-US")} kcal`;

  const pctCalories = reqCalories > 0 ? Math.min(100, Math.round((availCalories / reqCalories) * 100)) : 0;
  document.getElementById("pct-calories").innerHTML = `<strong>${pctCalories}% covered</strong>`;

  document.getElementById("stock-protein").textContent = availProtein;
  document.getElementById("total-protein").textContent = reqProtein;
  renderSegmentedGauge("gauge-protein", availProtein, reqProtein, "filled-sage");

  document.getElementById("stock-fats").textContent = availFats;
  document.getElementById("total-fats").textContent = reqFats;
  renderSegmentedGauge("gauge-fats", availFats, reqFats, "filled-rust");

  document.getElementById("stock-carbs").textContent = availCarbs;
  document.getElementById("total-carbs").textContent = reqCarbs;
  renderSegmentedGauge("gauge-carbs", availCarbs, reqCarbs, "filled-ochre");

  // Compute deficits & link back to Almanac priority badge
  const deficitsText = [];
  const deficientNames = [];

  if (availProtein < reqProtein) {
    deficitsText.push(`${reqProtein - availProtein}g protein`);
    deficientNames.push("Protein");
  }
  if (availFats < reqFats) {
    deficitsText.push(`${reqFats - availFats}g fats`);
    deficientNames.push("Fats");
  }
  if (availCarbs < reqCarbs) {
    deficitsText.push(`${reqCarbs - availCarbs}g carbs`);
    deficientNames.push("Carbs");
  }

  primaryDeficitNutrient = deficientNames[0] || null;

  const statusText = document.getElementById("macros-status");
  const priorityBadge = document.getElementById("almanac-priority");

  if (deficitsText.length === 0) {
    statusText.textContent = "OK — Daily nutritional targets met.";
    statusText.classList.add("is-complete");
    if (priorityBadge) {
      priorityBadge.textContent = "Priority: Balanced";
      priorityBadge.classList.add("is-balanced");
    }
  } else {
    statusText.textContent = `Current deficit: ${deficitsText.join(" / ")}.`;
    statusText.classList.remove("is-complete");
    if (priorityBadge) {
      priorityBadge.textContent = `Sowing priority: ${deficientNames.join(" & ")}`;
      priorityBadge.classList.remove("is-balanced");
    }
  }
}

/* =========================================
   02 / CONTRIBUTORS PIE CHART
   ========================================= */
function renderContributorsChart(availableItems) {
  const chartContainer = document.getElementById("pie-chart-container");
  const legendContainer = document.getElementById("pie-legend");
  const badge = document.getElementById("contributors-count-badge");
  if (!chartContainer || !legendContainer) return;

  const byAuthor = {};
  let totalCalories = 0;

  availableItems.forEach(item => {
    const kcal = Number(item.calories || 0);
    byAuthor[item.author] = (byAuthor[item.author] || 0) + kcal;
    totalCalories += kcal;
  });

  const contributors = Object.entries(byAuthor)
    .map(([name, calories]) => ({ name, calories }))
    .sort((a, b) => b.calories - a.calories);

  badge.textContent = `${contributors.length} active`;

  if (totalCalories === 0 || contributors.length === 0) {
    chartContainer.innerHTML = `<span class="macros-status">No data</span>`;
    legendContainer.innerHTML = "";
    return;
  }

  const colors = ["#5A7432", "#DFB548", "#4A8DB0", "#A65638", "#244732"];
  const inkColor = "#441C11";
  const cx = 80;
  const cy = 80;
  const r = 74;

  let startAngle = -Math.PI / 2;
  let svgPaths = "";

  contributors.forEach((c, idx) => {
    const color = colors[idx % colors.length];
    const fraction = c.calories / totalCalories;

    if (fraction >= 0.999) {
      svgPaths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="${inkColor}" stroke-width="1.5" />`;
    } else {
      const endAngle = startAngle + fraction * 2 * Math.PI;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = fraction > 0.5 ? 1 : 0;

      const d = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
      svgPaths += `<path d="${d}" fill="${color}" stroke="${inkColor}" stroke-width="1.5" stroke-linejoin="round" />`;
      startAngle = endAngle;
    }
  });

  chartContainer.innerHTML = `
    <svg viewBox="0 0 160 160" class="pie-svg" aria-hidden="true">
      ${svgPaths}
    </svg>
  `;

  legendContainer.innerHTML = contributors.map((c, idx) => {
    const color = colors[idx % colors.length];
    const pct = Math.round((c.calories / totalCalories) * 100);
    return `
      <li class="pie-legend-item">
        <span class="pie-legend-left">
          <span class="legend-square" style="background-color: ${color};" aria-hidden="true"></span>
          ${c.name}
        </span>
        <span class="pie-legend-right">
          ${c.calories.toLocaleString("en-US")} kcal (<strong>${pct}%</strong>)
        </span>
      </li>
    `;
  }).join("");
}

/* =========================================
   03 / PLANTING & HARVEST ALMANAC
   ========================================= */
function getMonthPhase(month, sowMonth, harvestMonth) {
  if (month === sowMonth && month === harvestMonth) return "both";
  if (month === sowMonth) return "sow";
  if (month === harvestMonth) return "harvest";

  if (sowMonth < harvestMonth) {
    if (month > sowMonth && month < harvestMonth) return "grow";
  } else {
    if (month > sowMonth || month < harvestMonth) return "grow";
  }
  return "empty";
}

function getNutrientPillClass(nutrient) {
  const key = nutrient.toLowerCase();
  if (key === "protein") return "pill-protein";
  if (key === "carbs") return "pill-carbs";
  if (key === "fats") return "pill-fats";
  return "pill-vitamins";
}

function renderAlmanac(entries) {
  const rowsContainer = document.getElementById("almanac-rows");
  const badge = document.getElementById("almanac-count-badge");
  const summary = document.getElementById("almanac-summary");
  if (!rowsContainer) return;

  const activeEntries = entries.filter(e => !e.harvested);
  const harvestedCount = entries.length - activeEntries.length;

  badge.textContent = `${activeEntries.length} active • ${harvestedCount} harvested`;

  if (entries.length === 0) {
    rowsContainer.innerHTML = `<div class="almanac-row-info">No crops planned yet. Click "Plan a crop" to add one.</div>`;
    summary.textContent = "No seasonal yield forecast available.";
    return;
  }

  // Show active crops first, harvested (greyed-out) rows at the bottom
  const sortedEntries = [...entries].sort((a, b) => Number(a.harvested) - Number(b.harvested));

  rowsContainer.innerHTML = sortedEntries.map(entry => {
    let monthCells = "";
    for (let m = 1; m <= 12; m++) {
      const phase = getMonthPhase(m, entry.sowMonth, entry.harvestMonth);
      let blockHtml = "";
      if (phase === "sow") blockHtml = `<span class="phase-block cell-sow" title="Sowing">S</span>`;
      else if (phase === "grow") blockHtml = `<span class="phase-block cell-grow" title="Growing"></span>`;
      else if (phase === "harvest") blockHtml = `<span class="phase-block cell-harvest" title="Harvest">H</span>`;
      else if (phase === "both") blockHtml = `<span class="phase-block cell-both" title="Sow &amp; Harvest">S/H</span>`;

      monthCells += `<div class="almanac-cell">${blockHtml}</div>`;
    }

    const rowClass = entry.harvested ? "almanac-grid almanac-row is-harvested" : "almanac-grid almanac-row";
    const stampHtml = entry.harvested
      ? `<span class="harvested-stamp">HARVESTED${entry.harvestedKg ? ` (${entry.harvestedKg} kg)` : ""}</span>`
      : "";

    return `
      <div class="${rowClass}">
        <div class="almanac-row-info">
          <div class="almanac-title-line">
            <span class="almanac-crop-title">${entry.crop}</span>
            ${stampHtml}
          </div>
          <div class="almanac-crop-meta">
            <span>${entry.member}</span>
            <span>•</span>
            <span class="nutrient-pill ${getNutrientPillClass(entry.nutrient)}">${entry.nutrient}</span>
            <span>•</span>
            <strong>~${entry.estimatedKg} kg</strong>
          </div>
        </div>
        ${monthCells}
      </div>
    `;
  }).join("");

  const upcomingKg = activeEntries.reduce((sum, e) => sum + Number(e.estimatedKg || 0), 0);
  const harvestedKg = entries
    .filter(e => e.harvested)
    .reduce((sum, e) => sum + Number(e.harvestedKg || e.estimatedKg || 0), 0);

  summary.textContent = `Upcoming forecast: ~${upcomingKg} kg across ${activeEntries.length} active crop(s) — Already harvested this season: ${harvestedKg} kg.`;
}

function populatePlannedCropsSelect() {
  const select = document.getElementById("harvest-calendar-link");
  if (!select) return;

  const activeCrops = calendarEntries.filter(e => !e.harvested);
  select.innerHTML = `<option value="">— Standalone / Unplanned harvest —</option>` +
    activeCrops.map(e => `
      <option value="${e.id}">${e.crop} — ${e.member} (est. ${e.estimatedKg} kg)</option>
    `).join("");
}

/* =========================================
   FORMS & INTERACTIVITY (POST-READY)
   ========================================= */
function openHarvestForm() {
  const almanacSection = document.getElementById("page-almanac");
  const cropPanel = document.getElementById("crop-form-panel");
  const harvestPanel = document.getElementById("harvest-form-panel");

  if (cropPanel) cropPanel.classList.add("is-hidden");
  if (harvestPanel) harvestPanel.classList.remove("is-hidden");
  if (almanacSection) almanacSection.scrollIntoView({ behavior: "smooth" });
}

function setupForms() {
  const toggleCropBtn = document.getElementById("toggle-crop-form-btn");
  const cancelCropBtn = document.getElementById("cancel-crop-form-btn");
  const cropPanel = document.getElementById("crop-form-panel");
  const cropForm = document.getElementById("crop-form");

  const toggleHarvestBtn = document.getElementById("toggle-harvest-form-btn");
  const cancelHarvestBtn = document.getElementById("cancel-harvest-form-btn");
  const harvestPanel = document.getElementById("harvest-form-panel");
  const harvestForm = document.getElementById("harvest-form");

  // Toggle Plan a Crop panel
  if (toggleCropBtn && cropPanel) {
    toggleCropBtn.addEventListener("click", () => {
      if (harvestPanel) harvestPanel.classList.add("is-hidden");
      cropPanel.classList.toggle("is-hidden");

      // Pre-select the top deficient nutrient when opening the form
      if (!cropPanel.classList.contains("is-hidden") && primaryDeficitNutrient) {
        const nutrientSelect = document.getElementById("crop-nutrient");
        if (nutrientSelect) nutrientSelect.value = primaryDeficitNutrient;
      }
    });
  }

  if (cancelCropBtn && cropPanel && cropForm) {
    cancelCropBtn.addEventListener("click", () => {
      cropPanel.classList.add("is-hidden");
      cropForm.reset();
    });
  }

  // Toggle Declare a Harvest panel
  if (toggleHarvestBtn && harvestPanel) {
    toggleHarvestBtn.addEventListener("click", () => {
      if (cropPanel) cropPanel.classList.add("is-hidden");
      harvestPanel.classList.toggle("is-hidden");
    });
  }

  if (cancelHarvestBtn && harvestPanel && harvestForm) {
    cancelHarvestBtn.addEventListener("click", () => {
      harvestPanel.classList.add("is-hidden");
      harvestForm.reset();
    });
  }

  // Auto-calculate macros when crop or weight changes
  const cropInput = document.getElementById("harvest-crop");
  const kgInput = document.getElementById("harvest-kg");
  const categorySelect = document.getElementById("harvest-category");
  const calInput = document.getElementById("harvest-calories");
  const protInput = document.getElementById("harvest-protein");
  const fatsInput = document.getElementById("harvest-fats");
  const carbsInput = document.getElementById("harvest-carbs");
  const calcHint = document.getElementById("harvest-calc-hint");
  const calendarLinkSelect = document.getElementById("harvest-calendar-link");

  function updateAutoCalculatedMacros() {
    const ref = findFoodReference(cropInput.value);
    const kg = parseFloat(kgInput.value);

    if (ref && !isNaN(kg) && kg > 0) {
      categorySelect.value = ref.category;
      calInput.value = Math.round(ref.kcalPerKg * kg);
      protInput.value = Math.round(ref.proteinPerKg * kg);
      fatsInput.value = Math.round(ref.fatsPerKg * kg);
      carbsInput.value = Math.round(ref.carbsPerKg * kg);
      calcHint.textContent = `Auto-calculated for ${kg} kg of ${ref.name} from reference table (editable).`;
      calcHint.classList.add("is-auto");
    } else if (ref) {
      categorySelect.value = ref.category;
      calcHint.textContent = `Matched "${ref.name}" — enter quantity in kg to calculate macros.`;
      calcHint.classList.remove("is-auto");
    } else if (cropInput.value.trim().length > 0) {
      calcHint.textContent = "Custom crop — enter calories, protein, fats and carbs manually.";
      calcHint.classList.remove("is-auto");
    } else {
      calcHint.textContent = "Pick a known crop and enter weight (kg) to auto-fill nutritional values. All fields remain editable.";
      calcHint.classList.remove("is-auto");
    }
  }

  if (cropInput && kgInput) {
    cropInput.addEventListener("input", updateAutoCalculatedMacros);
    kgInput.addEventListener("input", updateAutoCalculatedMacros);
  }

  // Pre-fill harvest form when linking a planned crop from the almanac
  if (calendarLinkSelect) {
    calendarLinkSelect.addEventListener("change", () => {
      const selectedId = parseInt(calendarLinkSelect.value, 10);
      if (!selectedId) return;

      const planned = calendarEntries.find(e => e.id === selectedId);
      if (!planned) return;

      document.getElementById("harvest-member").value = planned.member;
      cropInput.value = planned.crop;
      kgInput.value = planned.estimatedKg;
      updateAutoCalculatedMacros();
    });
  }

  // Submit 1: Plan a Crop (POST /api/calendar)
  if (cropForm) {
    cropForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const newEntry = {
        member: document.getElementById("crop-member").value.trim(),
        crop: document.getElementById("crop-name").value.trim(),
        nutrient: document.getElementById("crop-nutrient").value,
        estimatedKg: parseFloat(document.getElementById("crop-kg").value),
        sowMonth: parseInt(document.getElementById("crop-sow").value, 10),
        harvestMonth: parseInt(document.getElementById("crop-harvest").value, 10),
        harvested: false,
        harvestedKg: null
      };

      if (USE_MOCK) {
        newEntry.id = Date.now();
        calendarEntries.push(newEntry);
        refreshAllViews();
      } else {
        try {
          const response = await fetch(API_CALENDAR_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newEntry)
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const savedEntry = await response.json();
          calendarEntries.push(savedEntry);
          refreshAllViews();
        } catch (error) {
          console.error("Failed to save crop plan:", error);
          alert("Could not send crop plan to the Python server.");
          return;
        }
      }

      cropForm.reset();
      cropPanel.classList.add("is-hidden");
    });
  }

  // Submit 2: Declare a Harvest (POST /api/items)
  if (harvestForm) {
    harvestForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const linkedIdRaw = calendarLinkSelect.value;
      const calendarId = linkedIdRaw ? parseInt(linkedIdRaw, 10) : null;
      const cropName = cropInput.value.trim();
      const kg = parseFloat(kgInput.value);

      const newHarvest = {
        title: `${kg} kg of ${cropName}`,
        category: categorySelect.value,
        author: document.getElementById("harvest-member").value.trim(),
        distance: document.getElementById("harvest-distance").value.trim() || "150m",
        kg: kg,
        calories: parseInt(calInput.value, 10) || 0,
        protein: parseInt(protInput.value, 10) || 0,
        fats: parseInt(fatsInput.value, 10) || 0,
        carbs: parseInt(carbsInput.value, 10) || 0,
        calendarId: calendarId
      };

      if (USE_MOCK) {
        newHarvest.id = Date.now();
        stockItems.unshift(newHarvest);

        if (calendarId) {
          const planned = calendarEntries.find(e => e.id === calendarId);
          if (planned) {
            planned.harvested = true;
            planned.harvestedKg = kg;
          }
        }
        refreshAllViews();
      } else {
        try {
          const response = await fetch(API_ITEMS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newHarvest)
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const savedItem = await response.json();
          stockItems.unshift(savedItem);

          if (calendarId) {
            const planned = calendarEntries.find(e => e.id === calendarId);
            if (planned) {
              planned.harvested = true;
              planned.harvestedKg = kg;
            }
          }
          refreshAllViews();
        } catch (error) {
          console.error("Failed to save harvest:", error);
          alert("Could not send harvest to the Python server.");
          return;
        }
      }

      harvestForm.reset();
      calcHint.textContent = "Pick a known crop and enter weight (kg) to auto-fill nutritional values. All fields remain editable.";
      calcHint.classList.remove("is-auto");
      harvestPanel.classList.add("is-hidden");
    });
  }
}

setupForms();
loadData();