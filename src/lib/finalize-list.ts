import { CATEGORIES, MEAL_TYPES, type Category, type CategoryGroup, type FinalizedList, type GroceryItem } from "../types/index.js";
import { isFiniteNumber, isNonEmptyString } from "./validation.js";

export class FinalizedListValidationError extends Error {
  constructor(reason: string) {
    super(`Invalid finalized list: ${reason}`);
    this.name = "FinalizedListValidationError";
  }
}

const WEEK_OF_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function fail(reason: string): never {
  throw new FinalizedListValidationError(reason);
}

function requireNonEmptyString(value: unknown, label: string): void {
  if (!isNonEmptyString(value)) {
    fail(`${label} must be a non-empty string`);
  }
}

function requirePositiveNumber(value: unknown, label: string): void {
  if (!isFiniteNumber(value) || value <= 0) {
    fail(`${label} must be a positive number, got ${JSON.stringify(value)}`);
  }
}

function requireNonNegativeNumber(value: unknown, label: string): void {
  if (!isFiniteNumber(value) || value < 0) {
    fail(`${label} must be a non-negative number, got ${JSON.stringify(value)}`);
  }
}

function isValidCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

function validateMealPlanEntry(entry: unknown, index: number): void {
  if (typeof entry !== "object" || entry === null) {
    fail(`mealPlan[${index}] must be an object`);
  }
  const e = entry as Record<string, unknown>;
  requireNonEmptyString(e.id, `mealPlan[${index}].id`);
  requireNonEmptyString(e.name, `mealPlan[${index}].name`);
  requirePositiveNumber(e.servings, `mealPlan[${index}].servings`);
  if (!MEAL_TYPES.includes(e.mealType as (typeof MEAL_TYPES)[number])) {
    fail(`mealPlan[${index}].mealType must be one of ${MEAL_TYPES.join(", ")}, got ${JSON.stringify(e.mealType)}`);
  }
}

function validateGroceryItem(item: unknown, index: number): void {
  if (typeof item !== "object" || item === null) {
    fail(`groceryList[${index}] must be an object`);
  }
  const i = item as Record<string, unknown>;
  requireNonEmptyString(i.name, `groceryList[${index}].name`);
  // A zero amount is valid — e.g. "to taste" ingredients, matching recipes.ts's own rule.
  requireNonNegativeNumber(i.amount, `groceryList[${index}].amount`);
  requireNonEmptyString(i.unit, `groceryList[${index}].unit`);
  if (i.category !== undefined && !isValidCategory(i.category)) {
    fail(`groceryList[${index}].category must be one of ${CATEGORIES.join(", ")}, got ${JSON.stringify(i.category)}`);
  }
  if (i.isRepeat !== undefined && typeof i.isRepeat !== "boolean") {
    fail(`groceryList[${index}].isRepeat must be a boolean, got ${JSON.stringify(i.isRepeat)}`);
  }
}

/**
 * Validates the shape of a finalized `{weekOf, mealPlan, groceryList}` payload before it's
 * handed to `groupByCategory` and rendered as the HTML artifact.
 *
 * This is structural validation only (types, required fields, enum membership) — it does not
 * enforce business rules like a non-empty grocery list, and `category`/`isRepeat` on grocery
 * items are optional here (categorization happens conversationally before `groupByCategory`).
 *
 * @param input - The candidate finalized list, typically parsed from CLI JSON input.
 * @returns The same object, typed as {@link FinalizedList}, once every field checks out.
 * @throws {@link FinalizedListValidationError} If any field is missing or malformed.
 */
export function validateFinalizedList(input: unknown): FinalizedList {
  if (typeof input !== "object" || input === null) {
    fail("input must be an object");
  }
  const value = input as Record<string, unknown>;

  if (typeof value.weekOf !== "string" || !WEEK_OF_PATTERN.test(value.weekOf)) {
    fail(`weekOf must be a date string in YYYY-MM-DD format, got ${JSON.stringify(value.weekOf)}`);
  }

  if (!Array.isArray(value.mealPlan)) {
    fail(`mealPlan must be an array, got ${JSON.stringify(value.mealPlan)}`);
  }
  value.mealPlan.forEach(validateMealPlanEntry);

  if (!Array.isArray(value.groceryList)) {
    fail(`groceryList must be an array, got ${JSON.stringify(value.groceryList)}`);
  }
  value.groceryList.forEach(validateGroceryItem);

  return input as FinalizedList;
}

/**
 * Groups already-categorized grocery items into the five fixed display categories, in the
 * fixed order Dairy → Meat → Fresh Fruit & Veg (`produce`) → Dry Pantry Items (`pantry`) →
 * Household Goods (`household`), skipping categories with no items. Items within a category
 * keep their original relative order.
 *
 * @param items - Grocery items that have each already been assigned a valid `category` (by
 * Claude's judgment, conversationally, before this is called).
 * @returns Category groups in fixed order, omitting any category with no items.
 * @throws {@link FinalizedListValidationError} If any item is missing, or has an invalid, `category`.
 */
export function groupByCategory(items: GroceryItem[]): CategoryGroup[] {
  items.forEach((item) => {
    if (!isValidCategory(item.category)) {
      fail(`item "${item.name}" has an invalid category: ${JSON.stringify(item.category)}`);
    }
  });

  return CATEGORIES.map((category) => ({
    category,
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);
}
