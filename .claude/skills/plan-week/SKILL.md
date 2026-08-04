---
name: plan-week
description: Plan the weekly dinner lineup and build a merged grocery list from recipe ingredients — reuse saved recipes or add new ones, track dinner coverage against eaters needed, and get a deduplicated ingredient list. Use when the user wants to plan meals/dinners for the week or build a grocery list from recipes.
---

# Plan week

Runs the "plan dinners for the week → get a grocery list" conversation, calling
the deterministic scripts under `src/cli/` via the Bash tool and reasoning over
their JSON output.

**Current scope:** recipe collection/reuse, dinner-coverage tracking, and
exact-match grocery-list merging. No recipe scaling, no unit conversion, no
pantry cross-check, and no repeating/cadence items. The final grocery list
is presented as plain conversational text, not an HTML artifact.

Every script prints one JSON object to stdout and exits non-zero with a
stderr message on error — if a call fails, read the stderr message and either
fix the arguments or surface the problem to the user; don't guess at a fix.

## 1. Confirm defaults

Ask the user, offering the defaults as the easy "just go" answer:
- Dinners needed this week (default **6**)
- Eaters per dinner (default **2**)
- Any non-dinner recipes to add this week (breakfast/lunch/dessert/side)? Default **no**.

## 2. Collect dinner recipes

Run `npx tsx src/cli/load-recipes.ts` once, up front, so you can offer
existing recipes for reuse throughout this step.

Fill dinner slots one at a time. For each one, ask the user to:

- **Reuse an existing recipe** — pick from the `load-recipes.ts` list by
  name or id.
- **Paste recipe text** — parse the pasted text yourself into
  `{name, servings, ingredients, steps}` (this judgment call is yours, not a
  script's), then persist it:
  ```
  npx tsx src/cli/save-recipe.ts --name "<name>" --servings <n> --mealType dinner \
    --ingredients '[{"name":"...", "amount":1, "unit":"cup"}, ...]' \
    --steps '["step one", "step two"]'
  ```
- **Manual / no-recipe entry** (e.g. "Grilled Salmon, no recipe needed") —
  collect just a name, servings, and ingredient list conversationally, then:
  ```
  npx tsx src/cli/save-recipe.ts --name "<name>" --servings <n> --mealType dinner \
    --ingredients '[...]' --noRecipe
  ```

After each recipe is added, check running coverage by calling
`build-grocery-list.ts` with every dinner recipe id collected **so far**:

```
npx tsx src/cli/build-grocery-list.ts --recipe <id1> --recipe <id2> ... --dinners <n> --eaters <m>
```

Read `coverage.dinnersPlanned` / `coverage.dinnersRemaining` /
`coverage.isFullyCovered` and tell the user where they stand (e.g. "4 of 6
dinners covered, 2 to go"). No scaling suggestions at this stage — if a
slot's `status` is `"under"`, just note it plainly (the recipe won't fully
feed the table) and let the user decide whether to add another dinner recipe
or move on anyway. Stop collecting once `isFullyCovered` is true or the user
says they're done.

## 3. Optional extra/non-dinner recipes

If the user wanted extras, run the same collection loop from step 2 (reuse,
paste-and-save, or manual/no-recipe), setting `--mealType` to whatever the
user says it is (`breakfast`, `lunch`, `dessert`, `side`, `other`). Don't run
coverage checks for these — coverage only applies to dinners.

## 4. Build the final grocery list

Call `build-grocery-list.ts` once more, this time with **every** selected
recipe id — dinners plus any extras:

```
npx tsx src/cli/build-grocery-list.ts --recipe <id1> --recipe <id2> ... --dinners <n> --eaters <m>
```

Use this call's `groceryList` as the final merged ingredient list. Ignore
its `coverage` field if extras were included — mixing in non-dinner recipes
skews the coverage math, which was already established correctly in step 2.

## 5. Present results

Summarize conversationally, as plain text (no HTML artifact yet):
- The recipes selected for the week (dinners, then any extras), noting which
  were newly saved to the recipe library for future reuse.
- The dinner-coverage summary from step 2.
- The final deduplicated grocery list from step 4.
