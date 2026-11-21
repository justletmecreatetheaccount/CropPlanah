// Récoltes et surplus alimentaires disponibles dans la communauté
const MOCK_ITEMS = [
  {
    id: 1,
    titre: "1,2 kg de lentilles vertes",
    categorie: "Légumineuses",
    auteur: "Lina",
    distance: "200m",
    calories: 4000,
    proteines: 290,
    glucides: 680,
    lipides: 18
  },
  {
    id: 2,
    titre: "4 kg de courges & pommes de terre",
    categorie: "Légumes",
    auteur: "Marc",
    distance: "350m",
    calories: 2800,
    proteines: 55,
    glucides: 620,
    lipides: 10
  },
  {
    id: 3,
    titre: "500 g de noix & graines de tournesol",
    categorie: "Fruits & Noix",
    auteur: "Sami",
    distance: "150m",
    calories: 3100,
    proteines: 95,
    glucides: 70,
    lipides: 275
  }
];

// Besoins nutritionnels journaliers de chaque membre
const MOCK_COMMUNAUTE = {
  membres: [
    { nom: "Lina", caloriesRequises: 2100, proteinesRequises: 65, glucidesRequises: 260, lipidesRequises: 70 },
    { nom: "Marc", caloriesRequises: 2500, proteinesRequises: 85, glucidesRequises: 310, lipidesRequises: 85 },
    { nom: "Sami", caloriesRequises: 2300, proteinesRequises: 75, glucidesRequises: 280, lipidesRequises: 75 },
    { nom: "Nadia", caloriesRequises: 1950, proteinesRequises: 60, glucidesRequises: 240, lipidesRequises: 65 },
    { nom: "Yanis", caloriesRequises: 2600, proteinesRequises: 90, glucidesRequises: 320, lipidesRequises: 90 }
  ]
};