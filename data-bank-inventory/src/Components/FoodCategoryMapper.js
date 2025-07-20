// Food category mapping based on your data
export const FOOD_CATEGORY_MAPPING = {
  // Non-Food Items
  '01-Non-Foods': 'OTHER',
  'NONFOOD': 'OTHER',
  
  // Baby Food
  '02-Baby Food/Formula': 'MISC',
  'BABY': 'MISC',
  
  // Beverages
  '03-Beverages': 'MISC',
  'BEVERAGE': 'MISC',
  'WATER': 'MISC',
  
  // Bread/Bakery
  '04-Bread/Bakery': 'GRAIN',
  'BREAD': 'GRAIN',
  'BAKERY': 'GRAIN',
  
  // Cereal
  '05-Cereal': 'GRAIN',
  'OATS': 'GRAIN',
  'CEREAL': 'GRAIN',
  'CEREAL/BRK': 'GRAIN',
  'BREAKFAST': 'GRAIN',
  
  // Meals/Entrees
  '06-Meals/Entrees/Soups': 'PROTEIN',
  'ENTREE': 'PROTEIN',
  
  // Dairy
  '07-Dairy Products': 'DAIRY',
  'MILK': 'DAIRY',
  'DAIRY': 'DAIRY',
  
  // Desserts
  '08-Desserts': 'MISC',
  'DESSERT': 'MISC',
  
  // Fruits
  '10-Fruits Canned/Frozen': 'FRUIT',
  'FRUIT': 'FRUIT',
  'JUICE': 'FRUIT',
  'PEARS': 'FRUIT',
  'ORANGES': 'FRUIT',
  'PEACHES': 'FRUIT',
  'APPLESAUCE': 'FRUIT',
  '14-Juices': 'FRUIT',
  
  // Grains
  '11-Grains': 'GRAIN',
  'GRAIN': 'GRAIN',
  '21-Pasta': 'GRAIN',
  'PASTA': 'GRAIN',
  'RICE': 'GRAIN',
  '24-Rice': 'GRAIN',
  
  // Health/Beauty/Cleaning
  '12-Health/Beauty Care': 'OTHER',
  '13-Cleaning Products': 'OTHER',
  '20-Paper Products-Personal': 'OTHER',
  '22-Pet Foods/Care': 'OTHER',
  'PET-PROD': 'OTHER',
  
  // Protein
  '15-Meat/Fish/Poultry': 'PROTEIN',
  'CHICKEN': 'PROTEIN',
  'PRO-MEAT': 'PROTEIN',
  'SALMON': 'PROTEIN',
  'TUNA': 'PROTEIN',
  'PB': 'PROTEIN',
  '23-Non-Meat Protein': 'PROTEIN',
  'EGG': 'PROTEIN',
  'PINTO_BEAN': 'PROTEIN',
  'PRO-NON': 'PROTEIN',
  'BLACK_BEAN': 'PROTEIN',
  '31-Prepared & Perishable Food': 'PROTEIN',
  
  // Mixed/Misc
  '16-Mixed/Assorted': 'MISC',
  'MIXED/ASST': 'MISC',
  'MIXEDNUTR': 'MISC',
  'NON DAIRY': 'MISC',
  '17-Non-Dairy Aids': 'MISC',
  'MILK-SUB': 'MISC',
  'NUTRITION': 'MISC',
  '18-Nutrional Aids': 'MISC',
  '25-Snack Foods/Cookies': 'MISC',
  'SNACK': 'MISC',
  '26-Condiments': 'MISC',
  'CONDIMENT': 'MISC',
  'DRESSING': 'MISC',
  '29-Dough': 'MISC',
  'UNCKD DOGH': 'MISC',
  '30-Salvage Unsorted': 'MISC',
  
  // Vegetables
  '27-Vegetables Canned/Frozen': 'VEG',
  'CORN': 'VEG',
  'MIXED_VEG': 'VEG',
  'VEGETABLES': 'VEG',
  'PASTA_SAUC': 'VEG',
  'GREEN_BEAN': 'VEG',
  'TOMATOES': 'VEG',
  
  // Produce
  'FRT-TREE': 'PRODUCE',
  '28-Produce': 'PRODUCE',
  'PRODUCE': 'PRODUCE',
  'FRT-EXOTIC': 'PRODUCE',
  'VEG-FRUITS': 'PRODUCE',
  'VEG-EXOTIC': 'PRODUCE',
  'FRT-MELON': 'PRODUCE',
  'VEG-LEAFY': 'PRODUCE',
  'VEG-ROOTS': 'PRODUCE',
  'VEG-TUBER': 'PRODUCE',
  'FRT-BERRY': 'PRODUCE',
  'VEG-FLOWER': 'PRODUCE',
  'VEG-BULB': 'PRODUCE'
};

// MyPlate Goals Configuration
export const MYPLATE_GOALS = {
  VEG: { percentage: 15, palletTarget: 90 },
  FRUIT: { percentage: 15, palletTarget: 90 },
  DAIRY: { percentage: 3, palletTarget: 18 },
  GRAIN: { percentage: 15, palletTarget: 90 },
  PROTEIN: { percentage: 20, palletTarget: 120 },
  MISC: { percentage: 12, palletTarget: 72 },
  PRODUCE: { percentage: 20, palletTarget: 120 },
  OTHER: { percentage: 0, palletTarget: 0 }
};

// System Configuration
export const SYSTEM_CONFIG = {
  AVG_PALLET_WEIGHT: 1500, // pounds
  TARGET_CAPACITY: 900000, // Default, will be set at runtime
  TOLERANCE_PERCENTAGE: 2,
  WEEKLY_TARGET: 715000 // pounds
};

export const setTargetCapacity = (newCapacity) => {
  SYSTEM_CONFIG.TARGET_CAPACITY = newCapacity;
};

export const updateTargetCapacity = async (newCapacity, persistCallback) => {
  setTargetCapacity(newCapacity);
  if (persistCallback) {
    await persistCallback(newCapacity);
  }
};

// Helper function to get MyPlate category for food type
export const getMyPlateCategory = (foodType) => {
  return FOOD_CATEGORY_MAPPING[foodType] || 'MISC';
};

// Helper function to validate if category meets MyPlate goals
export const getCategoryStatus = (currentPercentage, goalPercentage, tolerance = 2) => {
  const upperBound = goalPercentage + tolerance;
  const lowerBound = goalPercentage - tolerance;
  
  if (currentPercentage > upperBound) return 'OVER';
  if (currentPercentage < lowerBound) return 'UNDER';
  return 'OKAY';
};
