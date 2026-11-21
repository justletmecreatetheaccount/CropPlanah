// Reference nutritional values per 1 kg (raw crops) for front-end auto-calculation
const FOOD_DATABASE = {
  "Green lentils":      { category: "Legumes",       kcalPerKg: 3520, proteinPerKg: 250, fatsPerKg: 11,  carbsPerKg: 600 },
  "Chickpeas":          { category: "Legumes",       kcalPerKg: 3640, proteinPerKg: 193, fatsPerKg: 60,  carbsPerKg: 607 },
  "Winter broad beans": { category: "Legumes",       kcalPerKg: 880,  proteinPerKg: 79,  fatsPerKg: 7,   carbsPerKg: 176 },
  "Butternut squash":   { category: "Vegetables",    kcalPerKg: 450,  proteinPerKg: 10,  fatsPerKg: 1,   carbsPerKg: 117 },
  "Potatoes":           { category: "Vegetables",    kcalPerKg: 770,  proteinPerKg: 20,  fatsPerKg: 1,   carbsPerKg: 175 },
  "Tomatoes":           { category: "Vegetables",    kcalPerKg: 180,  proteinPerKg: 9,   fatsPerKg: 2,   carbsPerKg: 39  },
  "Oilseed sunflowers": { category: "Fruits & Nuts", kcalPerKg: 5840, proteinPerKg: 208, fatsPerKg: 515, carbsPerKg: 200 },
  "Walnuts":            { category: "Fruits & Nuts", kcalPerKg: 6540, proteinPerKg: 152, fatsPerKg: 652, carbsPerKg: 137 },
  "Hazelnuts":          { category: "Fruits & Nuts", kcalPerKg: 6280, proteinPerKg: 150, fatsPerKg: 608, carbsPerKg: 167 },
  "Oats":               { category: "Grains",        kcalPerKg: 3890, proteinPerKg: 169, fatsPerKg: 69,  carbsPerKg: 663 }
};

// Available community harvests and food surpluses
const MOCK_ITEMS = [
  {
    id: 1,
    title: "1.2 kg of Green lentils",
    category: "Legumes",
    author: "Lina",
    distance: "200m",
    kg: 1.2,
    calories: 4000,
    protein: 290,
    carbs: 680,
    fats: 18,
    calendarId: null
  },
  {
    id: 2,
    title: "4 kg of Butternut squash & Potatoes",
    category: "Vegetables",
    author: "Marc",
    distance: "350m",
    kg: 4,
    calories: 2800,
    protein: 55,
    carbs: 620,
    fats: 10,
    calendarId: null
  },
  {
    id: 3,
    title: "0.5 kg of Walnuts & Sunflower seeds",
    category: "Fruits & Nuts",
    author: "Sami",
    distance: "150m",
    kg: 0.5,
    calories: 3100,
    protein: 95,
    carbs: 70,
    fats: 275,
    calendarId: null
  }
];

// Daily nutritional requirements per community member
const MOCK_COMMUNITY = {
  members: [
    { name: "Lina", requiredCalories: 2100, requiredProtein: 65, requiredCarbs: 260, requiredFats: 70 },
    { name: "Marc", requiredCalories: 2500, requiredProtein: 85, requiredCarbs: 310, requiredFats: 85 },
    { name: "Sami", requiredCalories: 2300, requiredProtein: 75, requiredCarbs: 280, requiredFats: 75 },
    { name: "Nadia", requiredCalories: 1950, requiredProtein: 60, requiredCarbs: 240, requiredFats: 65 },
    { name: "Yanis", requiredCalories: 2600, requiredProtein: 90, requiredCarbs: 320, requiredFats: 90 }
  ]
};

// Community planting & harvest almanac (months: 1 = Jan ... 12 = Dec)
const MOCK_CALENDAR = [
  {
    id: 1,
    member: "Lina",
    crop: "Green lentils",
    nutrient: "Protein",
    estimatedKg: 8,
    sowMonth: 4,
    harvestMonth: 8,
    harvested: false,
    harvestedKg: null
  },
  {
    id: 2,
    member: "Marc",
    crop: "Butternut squash",
    nutrient: "Carbs",
    estimatedKg: 18,
    sowMonth: 5,
    harvestMonth: 10,
    harvested: false,
    harvestedKg: null
  },
  {
    id: 3,
    member: "Sami",
    crop: "Oilseed sunflowers",
    nutrient: "Fats",
    estimatedKg: 6,
    sowMonth: 4,
    harvestMonth: 9,
    harvested: false,
    harvestedKg: null
  },
  {
    id: 4,
    member: "Nadia",
    crop: "Winter broad beans",
    nutrient: "Protein",
    estimatedKg: 10,
    sowMonth: 10,
    harvestMonth: 5,
    harvested: false,
    harvestedKg: null
  }
];