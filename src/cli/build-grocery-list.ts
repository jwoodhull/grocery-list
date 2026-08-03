import { parseArgs } from "node:util";
import { computeCoverage } from "../lib/servings.js";
import { mergeIngredients } from "../lib/grocery-list.js";
import { loadRecipe } from "../lib/recipes.js";
import type { Recipe } from "../types/index.js";

const USAGE = "Usage: build-grocery-list.ts --recipe <id> [--recipe <id> ...] [--dinners <n>] [--eaters <n>]";

try {
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

  const dinnersNeeded = Number(values.dinners ?? "6");
  const eatersPerDinner = Number(values.eaters ?? "2");

  if (!Number.isFinite(dinnersNeeded)) {
    console.error(`Error: --dinners must be a number, got "${values.dinners}"`);
    process.exit(1);
  }
  if (!Number.isFinite(eatersPerDinner)) {
    console.error(`Error: --eaters must be a number, got "${values.eaters}"`);
    process.exit(1);
  }

  const recipes: Recipe[] = values.recipe.map((id: string): Recipe => loadRecipe(id));

  const coverage = computeCoverage(
    recipes.map((r) => ({ recipeId: r.id, servings: r.servings })),
    dinnersNeeded,
    eatersPerDinner,
  );

  const groceryList = mergeIngredients(recipes.map((r) => r.ingredients));

  console.log(
    JSON.stringify({
      recipes: recipes.map((r) => ({ id: r.id, name: r.name, servings: r.servings })),
      coverage,
      groceryList,
    }),
  );
} catch (err) {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
}
