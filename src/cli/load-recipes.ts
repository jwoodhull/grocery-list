import { loadAllRecipes } from "../lib/recipes.js";

try {
  const recipes = loadAllRecipes();
  console.log(
    JSON.stringify({
      recipes: recipes.map((r) => ({ id: r.id, name: r.name, servings: r.servings, mealType: r.mealType })),
    }),
  );
} catch (err) {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
}
