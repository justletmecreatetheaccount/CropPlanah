const API_URL = "http://localhost:8000/api/items";
const USE_MOCK = true;

async function chargerDonnees() {
  let items = [];

  if (USE_MOCK) {
    items = MOCK_ITEMS;
  } else {
    try {
      const response = await fetch(API_URL);
      items = await response.json();
    } catch (error) {
      console.error("Erreur serveur Python :", error);
    }
  }

  afficherCartes(items);
  calculerEtAfficherNutrition(MOCK_COMMUNAUTE.membres, items);
}

function afficherCartes(items) {
  const container = document.getElementById("cards-container");
  container.innerHTML = items.map((item, index) => `
    <article class="harvest-card">
      <div>
        <div class="card-header">
          <span class="card-tag">${item.categorie}</span>
          <span class="card-meta">#0${index + 1} • ${item.distance}</span>
        </div>

        <h3 class="card-title">${item.titre}</h3>

        <div class="macros-table">
          <div class="macro-cell">
            <span class="macro-label">KCAL</span>
            <strong>${item.calories}</strong>
          </div>
          <div class="macro-cell">
            <span class="macro-label">PROT</span>
            <strong class="text-sage">${item.proteines}g</strong>
          </div>
          <div class="macro-cell">
            <span class="macro-label">LIP</span>
            <strong class="text-rust">${item.lipides}g</strong>
          </div>
          <div class="macro-cell">
            <span class="macro-label">GLUC</span>
            <strong>${item.glucides}g</strong>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <span>Producteur : <strong>${item.auteur}</strong></span>
        <span class="status-dispo">Dispo</span>
      </div>
    </article>
  `).join("");
}

function dessinerJaugeBatonnets(idConteneur, valeurActuelle, valeurTotale, classeRemplissage) {
  const nbBatonnetsTotal = 15;
  const ratio = valeurTotale > 0 ? valeurActuelle / valeurTotale : 0;
  const nbBatonnetsActifs = Math.min(nbBatonnetsTotal, Math.round(ratio * nbBatonnetsTotal));

  const conteneur = document.getElementById(idConteneur);
  if (!conteneur) return;

  conteneur.innerHTML = "";

  for (let i = 0; i < nbBatonnetsTotal; i++) {
    const estRempli = i < nbBatonnetsActifs;
    const classeSegment = estRempli ? `gauge-segment ${classeRemplissage}` : "gauge-segment";
    conteneur.innerHTML += `<div class="${classeSegment}"></div>`;
  }
}

function calculerEtAfficherNutrition(membres, itemsDisponibles) {
  const reqCalories = membres.reduce((acc, m) => acc + m.caloriesRequises, 0);
  const reqProteines = membres.reduce((acc, m) => acc + m.proteinesRequises, 0);
  const reqLipides = membres.reduce((acc, m) => acc + m.lipidesRequises, 0);
  const reqGlucides = membres.reduce((acc, m) => acc + m.glucidesRequises, 0);

  const dispCalories = itemsDisponibles.reduce((acc, i) => acc + i.calories, 0);
  const dispProteines = itemsDisponibles.reduce((acc, i) => acc + i.proteines, 0);
  const dispLipides = itemsDisponibles.reduce((acc, i) => acc + i.lipides, 0);
  const dispGlucides = itemsDisponibles.reduce((acc, i) => acc + i.glucides, 0);

  document.getElementById("nb-membres-badge").textContent = `${membres.length} membres`;
  document.getElementById("total-calories").textContent = reqCalories.toLocaleString("fr-FR");
  document.getElementById("stock-calories").textContent = `${dispCalories.toLocaleString("fr-FR")} kcal`;

  const pctCalories = Math.min(100, Math.round((dispCalories / reqCalories) * 100));
  document.getElementById("pct-calories").innerHTML = `<strong>${pctCalories}% couvert</strong>`;

  // 1. Protéines
  document.getElementById("stock-proteines").textContent = dispProteines;
  document.getElementById("total-proteines").textContent = reqProteines;
  dessinerJaugeBatonnets("jauge-proteines", dispProteines, reqProteines, "filled-sage");

  // 2. Lipides
  document.getElementById("stock-lipides").textContent = dispLipides;
  document.getElementById("total-lipides").textContent = reqLipides;
  dessinerJaugeBatonnets("jauge-lipides", dispLipides, reqLipides, "filled-rust");

  // 3. Glucides
  document.getElementById("stock-glucides").textContent = dispGlucides;
  document.getElementById("total-glucides").textContent = reqGlucides;
  dessinerJaugeBatonnets("jauge-glucides", dispGlucides, reqGlucides, "filled-ochre");

  // Diagnostic
  const manques = [];
  if (dispProteines < reqProteines) manques.push(`${reqProteines - dispProteines}g prot.`);
  if (dispLipides < reqLipides) manques.push(`${reqLipides - dispLipides}g lip.`);
  if (dispGlucides < reqGlucides) manques.push(`${reqGlucides - dispGlucides}g gluc.`);

  const texteStatut = document.getElementById("statut-macros");
  if (manques.length === 0) {
    texteStatut.textContent = "OK — Besoins journaliers couverts.";
    texteStatut.classList.add("is-complete");
  } else {
    texteStatut.textContent = `Déficit actuel : ${manques.join(" / ")}.`;
    texteStatut.classList.remove("is-complete");
  }
}

function ouvrirModal() {
  alert("Ici on ouvrira le formulaire pour déclarer une récolte !");
}

chargerDonnees();