import type { Ingredient } from "../types/index.js";

// Stage 7 (pantry.ts) will need this same normalization for matching — extract to a
// shared util then rather than duplicating it (see tech-spec.md Stage 7).
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Flattens and deduplicates ingredients across one or more recipes' ingredient lists.
 *
 * Ingredients are merged when their normalized name (trimmed, lowercased, whitespace-collapsed)
 * and unit both match exactly; matching amounts are summed. Different units for the same
 * ingredient name are kept as separate line items (no unit conversion at this stage). The
 * first-seen display name/casing is preserved for the merged entry.
 *
 * @param lists - One ingredient array per recipe (or any grouping) to merge together.
 * @returns The deduplicated, summed ingredient list, in order of first appearance.
 */
export function mergeIngredients(lists: Ingredient[][]): Ingredient[] {
  const flattened = lists.flat();
  const merged = new Map<string, Ingredient>();

  for (const ingredient of flattened) {
    const key = `${normalizeName(ingredient.name)} ${normalizeName(ingredient.unit)}`;
    const existing = merged.get(key);
    if (existing) {
      existing.amount += ingredient.amount;
    } else {
      merged.set(key, { ...ingredient });
    }
  }

  return [...merged.values()];
}
