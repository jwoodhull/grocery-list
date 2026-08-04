import { loadAllRecipes } from "../lib/recipes.js";
import { runCli } from "./util.js";

runCli(() => {
  const recipes = loadAllRecipes();
  console.log(
    JSON.stringify({
      recipes: recipes.map((r) => ({ id: r.id, name: r.name, servings: r.servings, mealType: r.mealType })),
    }),
  );
});
