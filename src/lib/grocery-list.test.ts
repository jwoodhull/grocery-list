import { describe, expect, it } from "vitest";
import { mergeIngredients } from "./grocery-list.js";

describe("mergeIngredients", () => {
  it("returns an empty array for no lists", () => {
    expect(mergeIngredients([])).toEqual([]);
  });

  it("returns an empty array for a single empty list", () => {
    expect(mergeIngredients([[]])).toEqual([]);
  });

  it("passes through a list with no duplicates unchanged", () => {
    const result = mergeIngredients([
      [
        { name: "chicken thighs", amount: 1.5, unit: "lb" },
        { name: "taco shells", amount: 8, unit: "count" },
      ],
    ]);
    expect(result).toEqual([
      { name: "chicken thighs", amount: 1.5, unit: "lb" },
      { name: "taco shells", amount: 8, unit: "count" },
    ]);
  });

  it("sums a duplicate ingredient within a single recipe", () => {
    const result = mergeIngredients([
      [
        { name: "olive oil", amount: 1, unit: "tbsp" },
        { name: "olive oil", amount: 2, unit: "tbsp" },
      ],
    ]);
    expect(result).toEqual([{ name: "olive oil", amount: 3, unit: "tbsp" }]);
  });

  it("sums the same name+unit across two different recipes", () => {
    const result = mergeIngredients([
      [{ name: "olive oil", amount: 1, unit: "tbsp" }],
      [{ name: "olive oil", amount: 2, unit: "tbsp" }],
    ]);
    expect(result).toEqual([{ name: "olive oil", amount: 3, unit: "tbsp" }]);
  });

  it("normalizes case/whitespace but keeps the first-seen display name", () => {
    const result = mergeIngredients([
      [{ name: "Olive Oil", amount: 1, unit: "tbsp" }],
      [{ name: "olive oil ", amount: 1, unit: "tbsp" }],
      [{ name: "olive  oil", amount: 1, unit: "tbsp" }],
    ]);
    expect(result).toEqual([{ name: "Olive Oil", amount: 3, unit: "tbsp" }]);
  });

  it("merges units differing only in case/whitespace", () => {
    const result = mergeIngredients([
      [{ name: "olive oil", amount: 1, unit: "tbsp" }],
      [{ name: "olive oil", amount: 2, unit: "Tbsp" }],
    ]);
    expect(result).toEqual([{ name: "olive oil", amount: 3, unit: "tbsp" }]);
  });

  it("keeps different units for the same ingredient as separate line items", () => {
    const result = mergeIngredients([
      [{ name: "flour", amount: 2, unit: "cup" }],
      [{ name: "flour", amount: 200, unit: "g" }],
    ]);
    expect(result).toEqual([
      { name: "flour", amount: 2, unit: "cup" },
      { name: "flour", amount: 200, unit: "g" },
    ]);
  });

  it("merges same-named-but-different-recipe ingredients by ingredient identity only", () => {
    const pasta1Ingredients = [
      { name: "garlic", amount: 1, unit: "clove" },
      { name: "tomato sauce", amount: 2, unit: "cup" },
    ];
    const pasta2Ingredients = [
      { name: "garlic", amount: 1, unit: "clove" },
      { name: "pesto", amount: 0.5, unit: "cup" },
    ];
    const result = mergeIngredients([pasta1Ingredients, pasta2Ingredients]);
    const garlic = result.find((i) => i.name === "garlic");
    expect(garlic).toEqual({ name: "garlic", amount: 2, unit: "clove" });
  });
});
