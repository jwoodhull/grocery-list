import fs from "node:fs";
import path from "node:path";
import { MEAL_TYPES, type Ingredient, type MealType, type Recipe } from "../types/index.js";

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

export class RecipeValidationError extends Error {
  constructor(reason: string) {
    super(`Invalid recipe: ${reason}`);
    this.name = "RecipeValidationError";
  }
}

export interface NewRecipeInput {
  id?: string;
  name: string;
  servings: number;
  mealType: MealType;
  sourceUrl?: string | null;
  noRecipe?: boolean;
  ingredients: Ingredient[];
  steps?: string[];
}

function requireNonEmpty(value: string | undefined, label: string): void {
  if (!value || value.trim().length === 0) {
    throw new RecipeValidationError(`${label} must not be empty`);
  }
}

function validateId(id: string): void {
  if (id.trim().length === 0) {
    throw new RecipeValidationError("id must not be empty");
  }
  if (id === "." || id === ".." || path.basename(id) !== id) {
    throw new RecipeValidationError(`id must be a plain filename segment, got "${id}"`);
  }
}

/**
 * Returns today's date as `YYYY-MM-DD` in the local timezone (not UTC).
 */
function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validateNewRecipeInput(input: NewRecipeInput): void {
  requireNonEmpty(input.name, "name");
  if (!Number.isFinite(input.servings) || input.servings <= 0) {
    throw new RecipeValidationError(`servings must be a positive number, got ${input.servings}`);
  }
  if (!MEAL_TYPES.includes(input.mealType)) {
    throw new RecipeValidationError(`mealType must be one of ${MEAL_TYPES.join(", ")}, got "${input.mealType}"`);
  }
  if (!Array.isArray(input.ingredients) || input.ingredients.length === 0) {
    throw new RecipeValidationError("ingredients must be a non-empty array");
  }
  input.ingredients.forEach((ingredient, i) => {
    requireNonEmpty(ingredient.name, `ingredients[${i}].name`);
    if (!Number.isFinite(ingredient.amount) || ingredient.amount < 0) {
      throw new RecipeValidationError(`ingredients[${i}].amount must be a non-negative number, got ${ingredient.amount}`);
    }
    requireNonEmpty(ingredient.unit, `ingredients[${i}].unit`);
  });
}

/**
 * Validates and persists a recipe to `<recipesDir>/<id>.json`, creating or overwriting as needed.
 *
 * `id` defaults to `slugify(input.name)` when not supplied, and must be a plain filename segment
 * (non-empty, no path separators or `.`/`..`) either way. Saving to an id that already has a
 * valid, readable file on disk is treated as an update: the existing `createdAt` is preserved and
 * `updatedAt` is bumped to `today`; a brand-new id, or one whose existing file is missing or
 * unreadable, gets both timestamps set to `today`.
 *
 * @param input - The recipe fields to save; `sourceUrl`/`noRecipe`/`steps` default to `null`/`false`/`[]`.
 * @param recipesDir - Directory to write into; defaults to `DEFAULT_RECIPES_DIR`.
 * @param today - Local date (`YYYY-MM-DD`) used for timestamps; defaults to today's local date.
 * @returns The saved {@link Recipe}, exactly as written to disk.
 * @throws {@link RecipeValidationError} If any field, including a caller-supplied `id`, fails validation.
 */
export function saveRecipe(
  input: NewRecipeInput,
  recipesDir: string = DEFAULT_RECIPES_DIR,
  today: string = localDateString(),
): Recipe {
  validateNewRecipeInput(input);

  const id = input.id ?? slugify(input.name);
  validateId(id);
  const filePath = path.join(recipesDir, `${id}.json`);

  let createdAt = today;
  try {
    createdAt = loadRecipe(id, recipesDir).createdAt;
  } catch (err) {
    if (!(err instanceof RecipeNotFoundError) && !(err instanceof RecipeLoadError)) {
      throw err;
    }
  }

  const recipe: Recipe = {
    id,
    name: input.name,
    servings: input.servings,
    mealType: input.mealType,
    sourceUrl: input.sourceUrl ?? null,
    noRecipe: input.noRecipe ?? false,
    ingredients: input.ingredients,
    steps: input.steps ?? [],
    createdAt,
    updatedAt: today,
  };

  fs.writeFileSync(filePath, JSON.stringify(recipe, null, 2));
  return recipe;
}
