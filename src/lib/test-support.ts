import fs from "node:fs";
import path from "node:path";
import type { Recipe } from "../types/index.js";

/** Writes a recipe fixture to `<dir>/<recipe.id>.json`, for tests using a tmpDir recipes directory. */
export function writeRecipe(dir: string, recipe: Recipe): void {
  fs.writeFileSync(path.join(dir, `${recipe.id}.json`), JSON.stringify(recipe));
}
