import { parseArgs } from "node:util";
import { computeCoverage } from "../lib/servings.js";
import { mergeIngredients } from "../lib/grocery-list.js";
import { loadRecipe } from "../lib/recipes.js";
import type { Recipe } from "../types/index.js";
import { parseNumberArg, runCli } from "./util.js";

const USAGE = "Usage: build-grocery-list.ts --recipe <id> [--recipe <id> ...] [--dinners <n>] [--eaters <n>]";

runCli(() => {
  const { values } = parseArgs({
    options: {
      recipe: { type: "string", multiple: true },
      dinners: { type: "string" },
      eaters: { type: "string" },
    },
  });

  if (!values.recipe || values.recipe.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }

  const dinnersNeeded = parseNumberArg("dinners", values.dinners ?? "6");
  const eatersPerDinner = parseNumberArg("eaters", values.eaters ?? "2");

  const recipes: Recipe[] = values.recipe.map((id: string): Recipe => loadRecipe(id));

  const coverage = computeCoverage(
    recipes.map((r) => ({ recipeId: r.id, servings: r.servings })),
    dinnersNeeded,
    eatersPerDinner,
  );

  const groceryList = mergeIngredients(recipes.map((r) => r.ingredients));

  console.log(
    JSON.stringify({
      recipes: recipes.map((r) => ({ id: r.id, name: r.name, servings: r.servings, mealType: r.mealType })),
      coverage,
      groceryList,
    }),
  );
});
