import fs from "node:fs";
import path from "node:path";
import type { Recipe } from "../types/index.js";

export const DEFAULT_RECIPES_DIR = path.join(process.cwd(), "data", "recipes");

export class RecipeNotFoundError extends Error {
  constructor(id: string, filePath: string) {
    super(`Recipe not found: "${id}" (expected file ${filePath})`);
    this.name = "RecipeNotFoundError";
  }
}

/**
 * Loads a single recipe by id from `<recipesDir>/<id>.json`.
 *
 * @param id - The recipe's stable id (matches its filename, sans extension).
 * @param recipesDir - Directory to load from; defaults to `DEFAULT_RECIPES_DIR`.
 * @returns The parsed {@link Recipe}.
 * @throws {@link RecipeNotFoundError} If no file exists for the given id.
 * @throws {@link RecipeLoadError} If the file contains invalid JSON, or its internal `id` doesn't match the requested id.
 */
export function loadRecipe(id: string, recipesDir: string = DEFAULT_RECIPES_DIR): Recipe {
  const filePath = path.join(recipesDir, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    throw new RecipeNotFoundError(id, filePath);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  let recipe: Recipe;
  try {
    recipe = JSON.parse(raw) as Recipe;
  } catch (err) {
    throw new RecipeLoadError(filePath, `invalid JSON (${(err as Error).message})`);
  }
  if (recipe.id !== id) {
    throw new RecipeLoadError(filePath, `internal id "${recipe.id}" does not match requested id "${id}"`);
  }
  return recipe;
}

export class RecipeLoadError extends Error {
  constructor(filePath: string, reason: string) {
    super(`Failed to load recipe file ${filePath}: ${reason}`);
    this.name = "RecipeLoadError";
  }
}

/**
 * Loads every recipe JSON file in a directory, sorted by id.
 *
 * @param recipesDir - Directory to scan; defaults to `DEFAULT_RECIPES_DIR`.
 * @returns All recipes found, sorted by `id` (empty array if the directory has none).
 * @throws {@link RecipeLoadError} If a file contains invalid JSON, or its internal `id` doesn't match its filename.
 */
export function loadAllRecipes(recipesDir: string = DEFAULT_RECIPES_DIR): Recipe[] {
  const files = fs.readdirSync(recipesDir).filter((f) => f.endsWith(".json"));
  const recipes = files.map((f) => {
    const filePath = path.join(recipesDir, f);
    const raw = fs.readFileSync(filePath, "utf-8");
    let recipe: Recipe;
    try {
      recipe = JSON.parse(raw) as Recipe;
    } catch (err) {
      throw new RecipeLoadError(filePath, `invalid JSON (${(err as Error).message})`);
    }
    const expectedId = f.slice(0, -".json".length);
    if (recipe.id !== expectedId) {
      throw new RecipeLoadError(filePath, `internal id "${recipe.id}" does not match filename "${f}"`);
    }
    return recipe;
  });
  return recipes.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Converts a recipe name into a kebab-case slug suitable for use as a recipe id/filename.
 *
 * @param name - The human-readable recipe name.
 * @returns The lowercased, hyphenated, punctuation-stripped slug.
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}
