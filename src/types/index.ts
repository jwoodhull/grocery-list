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

export const CATEGORIES = ["dairy", "meat", "produce", "pantry", "household"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface GroceryItem extends Ingredient {
  category?: Category;
  isRepeat?: boolean;
}

export type MealPlanEntry = Pick<Recipe, "id" | "name" | "servings" | "mealType">;

export interface FinalizedList {
  weekOf: string;
  mealPlan: MealPlanEntry[];
  groceryList: GroceryItem[];
}

export interface CategoryGroup {
  category: Category;
  items: GroceryItem[];
}
