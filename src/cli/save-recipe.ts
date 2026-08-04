import { parseArgs } from "node:util";
import { saveRecipe } from "../lib/recipes.js";
import type { Ingredient, MealType } from "../types/index.js";

const USAGE =
  'Usage: save-recipe.ts --name <name> --servings <n> --mealType <type> --ingredients <json> ' +
  "[--steps <json>] [--sourceUrl <url>] [--id <id>] [--noRecipe]";

function parseJsonArg<T>(flagName: string, raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error: --${flagName} must be valid JSON (${(err as Error).message})`);
    process.exit(1);
  }
}

try {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      servings: { type: "string" },
      mealType: { type: "string" },
      ingredients: { type: "string" },
      steps: { type: "string" },
      sourceUrl: { type: "string" },
      id: { type: "string" },
      noRecipe: { type: "boolean" },
    },
  });

  if (!values.name || !values.servings || !values.mealType || !values.ingredients) {
    console.error(USAGE);
    process.exit(1);
  }

  const servings = Number(values.servings);
  if (!Number.isFinite(servings)) {
    console.error(`Error: --servings must be a number, got "${values.servings}"`);
    process.exit(1);
  }

  const ingredients = parseJsonArg<Ingredient[]>("ingredients", values.ingredients);
  const steps = values.steps ? parseJsonArg<string[]>("steps", values.steps) : undefined;

  const recipe = saveRecipe({
    id: values.id,
    name: values.name,
    servings,
    mealType: values.mealType as MealType,
    sourceUrl: values.sourceUrl ?? null,
    noRecipe: values.noRecipe ?? false,
    ingredients,
    steps,
  });

  console.log(JSON.stringify(recipe));
} catch (err) {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
}
