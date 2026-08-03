import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Recipe } from "../types/index.js";
import { RecipeLoadError, RecipeNotFoundError, loadAllRecipes, loadRecipe, slugify } from "./recipes.js";

const pasta1: Recipe = {
  id: "pasta-1",
  name: "Pasta",
  servings: 4,
  mealType: "dinner",
  sourceUrl: null,
  noRecipe: false,
  ingredients: [
    { name: "garlic", amount: 1, unit: "clove" },
    { name: "tomato sauce", amount: 2, unit: "cup" },
  ],
  steps: ["Boil pasta.", "Add sauce."],
  createdAt: "2026-08-01",
  updatedAt: "2026-08-01",
};

const pasta2: Recipe = {
  id: "pasta-2",
  name: "Pasta",
  servings: 2,
  mealType: "dinner",
  sourceUrl: null,
  noRecipe: false,
  ingredients: [
    { name: "garlic", amount: 1, unit: "clove" },
    { name: "pesto", amount: 0.5, unit: "cup" },
  ],
  steps: ["Boil pasta.", "Toss with pesto."],
  createdAt: "2026-08-01",
  updatedAt: "2026-08-01",
};

const chickenTacos: Recipe = {
  id: "chicken-tacos",
  name: "Chicken Tacos",
  servings: 4,
  mealType: "dinner",
  sourceUrl: null,
  noRecipe: false,
  ingredients: [
    { name: "chicken thighs", amount: 1.5, unit: "lb" },
    { name: "taco shells", amount: 8, unit: "count" },
  ],
  steps: ["Season and grill chicken.", "Warm shells.", "Assemble."],
  createdAt: "2026-08-01",
  updatedAt: "2026-08-01",
};

function writeRecipe(dir: string, recipe: Recipe): void {
  fs.writeFileSync(path.join(dir, `${recipe.id}.json`), JSON.stringify(recipe));
}

describe("slugify", () => {
  it("lowercases and hyphenates a simple name", () => {
    expect(slugify("Chicken Tacos")).toBe("chicken-tacos");
  });

  it("collapses internal whitespace and trims", () => {
    expect(slugify("  Two   Spaces  ")).toBe("two-spaces");
  });

  it("strips punctuation without leaving stray hyphens", () => {
    expect(slugify("Mom's Chili!")).toBe("moms-chili");
  });

  it("leaves an already-simple name unchanged", () => {
    expect(slugify("Pasta")).toBe("pasta");
  });
});

describe("loadAllRecipes", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "recipes-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns an empty array for an empty directory", () => {
    expect(loadAllRecipes(tmpDir)).toEqual([]);
  });

  it("loads and sorts multiple recipes by id", () => {
    // written in reverse-alphabetical order so the test actually exercises sorting
    writeRecipe(tmpDir, pasta1);
    writeRecipe(tmpDir, chickenTacos);
    const result = loadAllRecipes(tmpDir);
    expect(result.map((r) => r.id)).toEqual(["chicken-tacos", "pasta-1"]);
  });

  it("throws RecipeLoadError when a file's internal id does not match its filename", () => {
    fs.writeFileSync(
      path.join(tmpDir, "mismatched.json"),
      JSON.stringify({ ...chickenTacos, id: "something-else" }),
    );
    expect(() => loadAllRecipes(tmpDir)).toThrow(RecipeLoadError);
    expect(() => loadAllRecipes(tmpDir)).toThrow(/mismatched\.json/);
    expect(() => loadAllRecipes(tmpDir)).toThrow(/something-else/);
  });

  it("throws a clear RecipeLoadError on malformed JSON, not a raw SyntaxError", () => {
    fs.writeFileSync(path.join(tmpDir, "broken.json"), "{ not valid json");
    expect(() => loadAllRecipes(tmpDir)).toThrow(RecipeLoadError);
    expect(() => loadAllRecipes(tmpDir)).toThrow(/broken\.json/);
  });

  it("treats recipes with the same name but different ids as distinct", () => {
    writeRecipe(tmpDir, pasta1);
    writeRecipe(tmpDir, pasta2);
    const result = loadAllRecipes(tmpDir);
    expect(result.map((r) => r.id)).toEqual(["pasta-1", "pasta-2"]);
    expect(result[0]?.ingredients).toEqual(pasta1.ingredients);
    expect(result[1]?.ingredients).toEqual(pasta2.ingredients);
  });
});

describe("loadRecipe", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "recipes-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads a recipe by id from the given directory", () => {
    writeRecipe(tmpDir, chickenTacos);
    expect(loadRecipe("chicken-tacos", tmpDir)).toEqual(chickenTacos);
  });

  it("throws RecipeNotFoundError for a missing id", () => {
    writeRecipe(tmpDir, chickenTacos);
    expect(() => loadRecipe("does-not-exist", tmpDir)).toThrow(RecipeNotFoundError);
  });

  it("throws RecipeLoadError when the file's internal id does not match the requested id", () => {
    fs.writeFileSync(path.join(tmpDir, "renamed.json"), JSON.stringify({ ...chickenTacos, id: "old-id" }));
    expect(() => loadRecipe("renamed", tmpDir)).toThrow(RecipeLoadError);
    expect(() => loadRecipe("renamed", tmpDir)).toThrow(/old-id/);
  });

  it("throws a clear RecipeLoadError on malformed JSON, not a raw SyntaxError", () => {
    fs.writeFileSync(path.join(tmpDir, "broken.json"), "{ not valid json");
    expect(() => loadRecipe("broken", tmpDir)).toThrow(RecipeLoadError);
  });
});
