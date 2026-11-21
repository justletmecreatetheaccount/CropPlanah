// Harvests and food surpluses available in the community
const MOCK_ITEMS = [
  {
    id: 1,
    title: "1.2 kg of green lentils",
    category: "Pulses",
    producer: "Lina",
    distance: "200m",
    calories: 4000,
    protein: 290,
    carbs: 680,
    fats: 18
  },
  {
    id: 2,
    title: "4 kg of squash & potatoes",
    category: "Vegetables",
    producer: "Marc",
    distance: "350m",
    calories: 2800,
    protein: 55,
    carbs: 620,
    fats: 10
  },
  {
    id: 3,
    title: "500 g of walnuts & sunflower seeds",
    category: "Fruits & Nuts",
    producer: "Sami",
    distance: "150m",
    calories: 3100,
    protein: 95,
    carbs: 70,
    fats: 275
  }
];

// Daily nutritional requirements of each member
const MOCK_COMMUNITY = {
  members: [
    { name: "Lina", requiredCalories: 2100, requiredProtein: 65, requiredCarbs: 260, requiredFats: 70 },
    { name: "Marc", requiredCalories: 2500, requiredProtein: 85, requiredCarbs: 310, requiredFats: 85 },
    { name: "Sami", requiredCalories: 2300, requiredProtein: 75, requiredCarbs: 280, requiredFats: 75 },
    { name: "Nadia", requiredCalories: 1950, requiredProtein: 60, requiredCarbs: 240, requiredFats: 65 },
    { name: "Yanis", requiredCalories: 2600, requiredProtein: 90, requiredCarbs: 320, requiredFats: 90 }
  ]
};
