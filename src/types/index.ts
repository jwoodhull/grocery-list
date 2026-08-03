export type MealType =
  | "dinner"
  | "breakfast"
  | "lunch"
  | "dessert"
  | "side"
  | "other";

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
