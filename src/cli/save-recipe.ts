import { parseArgs } from "node:util";
import { saveRecipe } from "../lib/recipes.js";
import type { Ingredient, MealType } from "../types/index.js";
import { parseJsonArg, parseNumberArg, runCli } from "./util.js";

const USAGE =
  'Usage: save-recipe.ts --name <name> --servings <n> --mealType <type> --ingredients <json> ' +
  "[--steps <json>] [--sourceUrl <url>] [--id <id>] [--noRecipe]";

runCli(() => {
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

  const servings = parseNumberArg("servings", values.servings);

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
});
