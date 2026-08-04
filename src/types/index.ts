export const MEAL_TYPES = ["dinner", "breakfast", "lunch", "dessert", "side", "other"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  mealType: MealType;
  sourceUrl: string | null;
  noRecipe: boolean;
  ingredients: Ingredient[];
  steps: string[];
  createdAt: string;
  updatedAt: string;
}
