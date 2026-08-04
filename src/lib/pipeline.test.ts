import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Recipe } from "../types/index.js";
import { mergeIngredients } from "./grocery-list.js";
import { loadAllRecipes } from "./recipes.js";
import { computeCoverage } from "./servings.js";
import { writeRecipe } from "./test-support.js";

// Stage 2 smoke test: regression insurance for the full "recipes -> coverage ->
// grocery-list" pipeline the skill depends on, run end to end in one call against
// fixture data (never the real data/ directory). Later stages extend this same
// file to chain in scaling -> cadence -> pantry as those modules land.

const tacos: Recipe = {
  id: "tacos",
  name: "Tacos",
  servings: 4,
  mealType: "dinner",
  sourceUrl: null,
  noRecipe: false,
  ingredients: [
    { name: "chicken thighs", amount: 1.5, unit: "lb" },
    { name: "taco shells", amount: 8, unit: "count" },
  ],
  steps: ["Cook chicken.", "Assemble."],
  createdAt: "2026-08-01",
  updatedAt: "2026-08-01",
};

const salmon: Recipe = {
  id: "salmon",
  name: "Grilled Salmon",
  servings: 8,
  mealType: "dinner",
  sourceUrl: null,
  noRecipe: true,
  ingredients: [
    { name: "salmon fillets", amount: 4, unit: "count" },
    { name: "taco shells", amount: 2, unit: "count" },
  ],
  steps: [],
  createdAt: "2026-08-01",
  updatedAt: "2026-08-01",
};

describe("plan-week pipeline (recipes -> coverage -> grocery-list)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("chains recipe loading, coverage, and merging into one consistent result", () => {
    writeRecipe(tmpDir, tacos);
    writeRecipe(tmpDir, salmon);

    const recipes = loadAllRecipes(tmpDir);
    expect(recipes.map((r) => r.id)).toEqual(["salmon", "tacos"]);

    const coverage = computeCoverage(
      recipes.map((r) => ({ recipeId: r.id, servings: r.servings })),
      6,
      2,
    );
    // salmon (8 servings / 2 eaters) covers 4 nights, tacos (4/2) covers 2 nights.
    expect(coverage.dinnersPlanned).toBe(6);
    expect(coverage.dinnersRemaining).toBe(0);
    expect(coverage.isFullyCovered).toBe(true);

    const groceryList = mergeIngredients(recipes.map((r) => r.ingredients));
    // "taco shells" appears in both recipes with the same unit and should merge.
    const tacoShells = groceryList.find((i) => i.name === "taco shells");
    expect(tacoShells?.amount).toBe(10);
    expect(groceryList).toHaveLength(3);
  });
});
