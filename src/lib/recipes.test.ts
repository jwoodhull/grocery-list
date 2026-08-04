import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Recipe } from "../types/index.js";
import {
  RecipeLoadError,
  RecipeNotFoundError,
  RecipeValidationError,
  loadAllRecipes,
  loadRecipe,
  saveRecipe,
  slugify,
} from "./recipes.js";
import { writeRecipe } from "./test-support.js";

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

describe("saveRecipe", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "recipes-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const validInput = {
    name: "Test Soup",
    servings: 4,
    mealType: "dinner" as const,
    ingredients: [{ name: "broth", amount: 4, unit: "cup" }],
  };

  it("derives id from slugify(name) and sets both timestamps to today when new", () => {
    const saved = saveRecipe(validInput, tmpDir, "2026-08-03");
    expect(saved.id).toBe("test-soup");
    expect(saved.createdAt).toBe("2026-08-03");
    expect(saved.updatedAt).toBe("2026-08-03");
    expect(saved.sourceUrl).toBeNull();
    expect(saved.noRecipe).toBe(false);
    expect(saved.steps).toEqual([]);
    expect(loadRecipe("test-soup", tmpDir)).toEqual(saved);
  });

  it("honors an explicit id instead of deriving one", () => {
    const saved = saveRecipe({ ...validInput, id: "custom-id" }, tmpDir, "2026-08-03");
    expect(saved.id).toBe("custom-id");
    expect(loadRecipe("custom-id", tmpDir)).toEqual(saved);
  });

  it("preserves createdAt and bumps updatedAt when re-saving an existing id", () => {
    saveRecipe(validInput, tmpDir, "2026-08-01");
    const updated = saveRecipe({ ...validInput, servings: 6 }, tmpDir, "2026-08-03");
    expect(updated.createdAt).toBe("2026-08-01");
    expect(updated.updatedAt).toBe("2026-08-03");
    expect(updated.servings).toBe(6);
  });

  it("throws RecipeValidationError for an empty name", () => {
    expect(() => saveRecipe({ ...validInput, name: "  " }, tmpDir)).toThrow(RecipeValidationError);
    expect(() => saveRecipe({ ...validInput, name: "  " }, tmpDir)).toThrow(/name/);
  });

  it("throws RecipeValidationError for a non-positive servings", () => {
    expect(() => saveRecipe({ ...validInput, servings: 0 }, tmpDir)).toThrow(/servings/);
    expect(() => saveRecipe({ ...validInput, servings: -2 }, tmpDir)).toThrow(RecipeValidationError);
  });

  it("throws RecipeValidationError for a non-finite servings", () => {
    expect(() => saveRecipe({ ...validInput, servings: NaN }, tmpDir)).toThrow(/servings/);
    expect(() => saveRecipe({ ...validInput, servings: Infinity }, tmpDir)).toThrow(/servings/);
  });

  it("throws RecipeValidationError for an invalid mealType", () => {
    // @ts-expect-error - intentionally invalid for the test
    expect(() => saveRecipe({ ...validInput, mealType: "brunch" }, tmpDir)).toThrow(/mealType/);
  });

  it("throws RecipeValidationError for an empty ingredients array", () => {
    expect(() => saveRecipe({ ...validInput, ingredients: [] }, tmpDir)).toThrow(/ingredients/);
  });

  it("throws RecipeValidationError for an ingredient with an empty name", () => {
    expect(() =>
      saveRecipe({ ...validInput, ingredients: [{ name: "", amount: 1, unit: "cup" }] }, tmpDir),
    ).toThrow(/ingredients\[0\]\.name/);
  });

  it("throws RecipeValidationError for a negative ingredient amount", () => {
    expect(() =>
      saveRecipe({ ...validInput, ingredients: [{ name: "broth", amount: -1, unit: "cup" }] }, tmpDir),
    ).toThrow(/ingredients\[0\]\.amount/);
  });

  it("throws RecipeValidationError for a non-finite ingredient amount", () => {
    expect(() =>
      saveRecipe({ ...validInput, ingredients: [{ name: "broth", amount: NaN, unit: "cup" }] }, tmpDir),
    ).toThrow(/ingredients\[0\]\.amount/);
  });

  it("accepts a zero ingredient amount (e.g. 'to taste')", () => {
    const saved = saveRecipe(
      { ...validInput, ingredients: [{ name: "salt", amount: 0, unit: "to taste" }] },
      tmpDir,
    );
    expect(saved.ingredients).toEqual([{ name: "salt", amount: 0, unit: "to taste" }]);
  });

  it("throws RecipeValidationError for an ingredient with an empty unit", () => {
    expect(() =>
      saveRecipe({ ...validInput, ingredients: [{ name: "broth", amount: 1, unit: "" }] }, tmpDir),
    ).toThrow(/ingredients\[0\]\.unit/);
  });

  it("defaults today to the local date, not the UTC date", () => {
    const saved = saveRecipe(validInput, tmpDir);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(saved.createdAt).toBe(expected);
  });

  it.each(["", "..", ".", "../evil", "sub/evil"])("rejects an unsafe id %j", (id) => {
    expect(() => saveRecipe({ ...validInput, id }, tmpDir)).toThrow(RecipeValidationError);
    expect(fs.existsSync(path.join(tmpDir, "..", "evil.json"))).toBe(false);
  });

  it("treats a corrupted existing file as new rather than blocking the overwrite", () => {
    fs.writeFileSync(path.join(tmpDir, "test-soup.json"), JSON.stringify({ ...pasta1, id: "wrong-id" }));
    const saved = saveRecipe(validInput, tmpDir, "2026-08-03");
    expect(saved.createdAt).toBe("2026-08-03");
    expect(loadRecipe("test-soup", tmpDir)).toEqual(saved);
  });
});
