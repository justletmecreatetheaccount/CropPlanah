const API_URL = "http://localhost:8000/api/items";
const USE_MOCK = true;

async function loadData() {
  let items = [];

  if (USE_MOCK) {
    items = MOCK_ITEMS;
  } else {
    try {
      const response = await fetch(API_URL);
      items = await response.json();
    } catch (error) {
      console.error("Python server error:", error);
    }
  }

  renderCards(items);
  computeAndDisplayNutrition(MOCK_COMMUNITY.members, items);
}

function renderCards(items) {
  const container = document.getElementById("cards-container");
  container.innerHTML = items.map((item, index) => `
    <article class="harvest-card">
      <div>
        <div class="card-header">
          <span class="card-tag">${item.category}</span>
          <span class="card-meta">#0${index + 1} • ${item.distance}</span>
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
            <span class="macro-label">FAT</span>
            <strong class="text-rust">${item.fats}g</strong>
          </div>
          <div class="macro-cell">
            <span class="macro-label">CARB</span>
            <strong>${item.carbs}g</strong>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <span>Producer: <strong>${item.producer}</strong></span>
        <span class="status-available">In stock</span>
      </div>
    </article>
  `).join("");
}

function drawSegmentGauge(containerId, currentValue, totalValue, fillClass) {
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

function computeAndDisplayNutrition(members, availableItems) {
  const reqCalories = members.reduce((acc, m) => acc + m.requiredCalories, 0);
  const reqProtein = members.reduce((acc, m) => acc + m.requiredProtein, 0);
  const reqFats = members.reduce((acc, m) => acc + m.requiredFats, 0);
  const reqCarbs = members.reduce((acc, m) => acc + m.requiredCarbs, 0);

  const dispCalories = availableItems.reduce((acc, i) => acc + i.calories, 0);
  const dispProtein = availableItems.reduce((acc, i) => acc + i.protein, 0);
  const dispFats = availableItems.reduce((acc, i) => acc + i.fats, 0);
  const dispCarbs = availableItems.reduce((acc, i) => acc + i.carbs, 0);

  document.getElementById("members-badge").textContent = `${members.length} members`;
  document.getElementById("total-calories").textContent = reqCalories.toLocaleString("en-US");
  document.getElementById("stock-calories").textContent = `${dispCalories.toLocaleString("en-US")} kcal`;

  const pctCalories = Math.min(100, Math.round((dispCalories / reqCalories) * 100));
  document.getElementById("pct-calories").innerHTML = `<strong>${pctCalories}% covered</strong>`;

  // 1. Protein
  document.getElementById("stock-protein").textContent = dispProtein;
  document.getElementById("total-protein").textContent = reqProtein;
  drawSegmentGauge("gauge-protein", dispProtein, reqProtein, "filled-sage");

  // 2. Fats
  document.getElementById("stock-fats").textContent = dispFats;
  document.getElementById("total-fats").textContent = reqFats;
  drawSegmentGauge("gauge-fats", dispFats, reqFats, "filled-rust");

  // 3. Carbs
  document.getElementById("stock-carbs").textContent = dispCarbs;
  document.getElementById("total-carbs").textContent = reqCarbs;
  drawSegmentGauge("gauge-carbs", dispCarbs, reqCarbs, "filled-ochre");

  // Diagnosis
  const deficits = [];
  if (dispProtein < reqProtein) deficits.push(`${reqProtein - dispProtein}g protein`);
  if (dispFats < reqFats) deficits.push(`${reqFats - dispFats}g fats`);
  if (dispCarbs < reqCarbs) deficits.push(`${reqCarbs - dispCarbs}g carbs`);

  const statusText = document.getElementById("macros-status");
  if (deficits.length === 0) {
    statusText.textContent = "OK — Daily needs covered.";
    statusText.classList.add("is-complete");
  } else {
    statusText.textContent = `Current deficit: ${deficits.join(" / ")}.`;
    statusText.classList.remove("is-complete");
  }
}

function openModal() {
  alert("The surplus declaration form will open here!");
}

loadData();
