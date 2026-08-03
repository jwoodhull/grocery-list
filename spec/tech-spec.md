# Technical Spec: Weekly Menu / Grocery Planner

This document translates `spec/grocery-list-spec.md` (the product spec) into an implementation plan. It is the source of truth for tooling choices, data schemas, module boundaries, skill design, and the phased build order. See `CLAUDE.md` for a short project summary.

## 0. Summary of approach

The system is a **Claude Code skill** (`.claude/skills/plan-week/`) backed by a library of **deterministic TypeScript scripts** in `/src`. The split is deliberate:

- **Deterministic logic** (dedup, unit math, scaling, cadence due-dates, CSV/JSON I/O, pantry name-matching) lives in tested TS functions under `/src/lib`, each exposed via a thin CLI wrapper under `/src/cli` that the skill invokes via the Bash tool.
- **Judgment calls** (parsing pasted recipe text, deciding what to ask and when, presentation/wording, HTML artifact composition) stay in the skill's `SKILL.md` instructions, executed conversationally by Claude.

Storage is plain CSV and JSON under `/data` — no database. This is a single-user personal tool: no auth, no server, no CI pipeline, minimal tooling.

## 1. Environment / tooling

| Concern          | Decision                                                                                                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager  | npm, single committed `package-lock.json`                                                                                                                                                                                                                                  |
| Node version     | `engines.node: ">=20.0.0"` (loose LTS-line minimum; local dev machine runs v26.5.0, exact pin not critical for a personal single-machine tool)                                                                                                                             |
| Module system    | ESM (`"type": "module"` in `package.json`) — Node-only, no browser bundling, so ESM avoids CJS/ESM interop friction                                                                                                                                                        |
| Execution        | Run TypeScript directly via `tsx` (`npx tsx src/cli/<name>.ts ...`) — no build step. Preferred over `ts-node` (worse ESM ergonomics) and over `tsc`-then-`node dist/` (an extra step to keep in sync with no payoff for a tool that's never "shipped" as a build artifact) |
| Type checking    | `tsc --noEmit` as a separate `npm run typecheck` verification step, not part of the run path                                                                                                                                                                               |
| Test framework   | Vitest, zero-config defaults. Tests colocated as `*.test.ts` next to the module under test (e.g. `src/lib/grocery-list.ts` + `src/lib/grocery-list.test.ts`)                                                                                                               |
| Lint/format      | Skipped for v1. TypeScript `strict` mode + Vitest already catch what matters for a single-user tool; revisit only if it becomes a real pain point                                                                                                                          |
| New dependencies | `typescript`, `tsx`, `vitest`, `@types/node` (dev); `csv-parse`, `csv-stringify` (runtime) — a small CSV dependency avoids quoting/escaping bugs if an ingredient or item name ever contains a comma or quote                                                              |

`tsconfig.json`: `target: "ES2022"`, `module`/`moduleResolution: "NodeNext"`, `strict: true`, `rootDir: "src"`, `include: ["src/**/*"]`.

`package.json` scripts: `test` → `vitest run`, `test:watch` → `vitest`, `typecheck` → `tsc --noEmit`.

**Data files are committed to git.** `data/*.csv`, `data/recipes/*.json`, and `data/history.json` are real user data in a personal repo, not a template — they're checked in like any other project file. `.gitignore` covers only `node_modules/` and `dist/`.

## 2. Directory scaffold

```
/data
  /recipes/                  # one JSON file per recipe, e.g. chicken-tacos.json
  pantry.csv
  repeating.csv
  history.json
/src
  /types/
    index.ts                 # Recipe, Ingredient, PantryItem, RepeatingItem, WeekRecord, etc.
  /lib/                       # pure, unit-tested TS functions — see §4
    csv.ts
    pantryStore.ts
    repeatingStore.ts
    recipes.ts
    servings.ts
    scaling.ts
    units.ts
    grocery-list.ts
    cadence.ts
    pantry.ts
    history.ts
    *.test.ts                 # colocated tests
  /cli/                        # thin node:util.parseArgs wrappers around lib/, JSON in -> JSON out
    load-recipes.ts
    save-recipe.ts
    check-coverage.ts
    scale-recipe.ts
    build-grocery-list.ts
    due-items.ts
    check-pantry.ts
    update-pantry.ts
    update-repeating.ts
    detect-recurring.ts
    append-history.ts
.claude/skills/plan-week/
  SKILL.md
  references/                  # cli-scripts.md, data-schemas.md — added only if SKILL.md grows too large
package.json
tsconfig.json
.gitignore                     # node_modules/, dist/
spec/
  grocery-list-spec.md
  tech-spec.md
```

**CLI convention:** every script in `/src/cli` prints exactly one JSON object to stdout and exits non-zero with a message on stderr on error. This matters because the caller is an LLM (the skill) reading Bash tool output — structured JSON is far more reliable to parse correctly than hand-formatted text.

## 3. Data schemas

### `data/pantry.csv`

```
name,amount,unit,updated_at
olive oil,1,bottle,2026-07-20
chicken thighs,2,lb,2026-08-01
```

- `name`: free text as entered. All matching elsewhere uses a normalized copy (lowercased, trimmed, whitespace-collapsed) — never this raw field directly.
- `amount`: number; may be blank/0 to mean "have some, unknown quantity." Presence of a row means "on hand" regardless of amount — the spec only asks to flag possible matches, not manage precise stock levels.
- `unit`: free text (`lb`, `bottle`, `count`, ...).
- `updated_at`: ISO date (`YYYY-MM-DD`), set whenever the row is upserted.

### `data/repeating.csv`

Covers both "every week" and "every N weeks" cadence items in one file:

```
name,cadence_weeks,last_purchased,category
salad,1,2026-08-01,produce
salad dressing,2,2026-07-25,pantry
napkins,4,,household
```

- `name`: free text, normalized for matching the same way as pantry.
- `cadence_weeks`: positive integer. `1` = every week. `N` = every N weeks (e.g. salad dressing = 2, napkins ≈ "once a month" = 4 — cadence is whole-week granularity only, no true calendar-month support).
- `last_purchased`: ISO date, or empty string meaning "never purchased" → always due.
- `category`: optional, one of the fixed enum `dairy | meat | produce | pantry | household` — matches the five display categories the HTML artifact sorts by (Dairy, Meat, Fresh Fruit & Veg, Dry Pantry Items, Household Goods; see Stage 3 in §6). Used directly for sorting when present; if blank, Claude assigns a category by judgment at artifact-composition time, same as it does for recipe-derived items (which have no category field at all).

Due calculation (`cadence.ts`):

```
isDue(item, today) =
  item.last_purchased == ""
  || (today - item.last_purchased in days) >= item.cadence_weeks * 7
```

### `data/recipes/<slug>.json`

One file per recipe:

```json
{
  "id": "chicken-tacos",
  "name": "Chicken Tacos",
  "servings": 4,
  "mealType": "dinner",
  "sourceUrl": null,
  "noRecipe": false,
  "ingredients": [
    { "name": "chicken thighs", "amount": 1.5, "unit": "lb" },
    { "name": "taco shells", "amount": 8, "unit": "count" }
  ],
  "steps": ["Season and grill chicken.", "Warm shells.", "Assemble."],
  "createdAt": "2026-08-01",
  "updatedAt": "2026-08-01"
}
```

- `id`: kebab-case slug derived from `name`; also the filename (`<id>.json`) and the stable key for reusing a recipe across weeks ("I repeat recipes").
- `mealType`: `"dinner" | "breakfast" | "lunch" | "dessert" | "side" | "other"` — supports non-dinner recipes.
- `noRecipe`: `true` for the "Grilled Salmon, no recipe needed" case. The **same shape** is reused rather than a separate schema: `servings`/`ingredients` are still required (so scaling/dedup math is uniform), `steps` is `[]`, `sourceUrl` stays `null`. Every downstream script stays agnostic to whether a recipe is "real" or manually entered.
- `sourceUrl`: optional, `null` if absent. Carried for a future (deferred) URL-import feature.
- `createdAt`/`updatedAt`: bookkeeping, not in the product spec but trivial and useful.

### `data/history.json`

Not one of the three file locations originally specified, but required to satisfy the "notice new repeated items" user story, which needs to know what's shown up on past weeks' lists. A single JSON array, one record per finalized week:

```json
[
  {
    "weekOf": "2026-07-27",
    "items": ["salad", "milk", "chicken thighs", "paper towels"]
  },
  {
    "weekOf": "2026-08-03",
    "items": ["salad", "milk", "napkins", "paper towels"]
  }
]
```

- `items`: normalized item names only from that week's _finalized_ grocery list — no quantities needed for recurrence detection, keeping the file minimal.
- Appended once per week at finalize time (Stage 9).
- `detectRecurringCandidates` scans the last 4 records for names appearing in ≥3 of them that aren't already in `repeating.csv`, and returns them as candidates for the skill to offer adding. Threshold is a constant in `history.ts`, easy to tune later.

## 4. Script/module boundary

This is the core architectural decision, made explicit function by function.

**Deterministic logic → `/src/lib` (pure, unit-tested), each with a thin `/src/cli` wrapper:**

| Module                                 | Responsibility                                                                                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `csv.ts`                               | Generic typed CSV read/write via `csv-parse`/`csv-stringify`                                                                                                                                                                                 |
| `pantryStore.ts` / `repeatingStore.ts` | Typed load/save wrappers around `csv.ts` for the pantry/repeating schemas, including upsert-by-normalized-name                                                                                                                               |
| `recipes.ts`                           | `loadRecipe(id)`, `loadAllRecipes()`, `saveRecipe(recipe)`, `slugify(name)`                                                                                                                                                                  |
| `servings.ts`                          | `computeCoverage(plannedMeals, dinnersNeeded, eatersPerDinner)` → per-slot under/over/exact status                                                                                                                                           |
| `scaling.ts`                           | `scaleRecipe(recipe, factor)` (multiplies ingredient amounts), `determineScaleFactor(recipeServings, neededServings)` (suggests a multiplier)                                                                                                |
| `units.ts`                             | Conversion tables for a volume family (tsp/tbsp/cup/pint/quart/gallon) and a weight family (oz/lb); `toBase`/`fromBase` plus a sensible display-unit picker. Count/other units are never converted, only exact-matched                       |
| `grocery-list.ts`                      | `mergeIngredients(lists)` — normalized-name dedup; same-unit-family amounts are converted to a common base and summed via `units.ts`; different families or unconvertible units are kept as separate line items rather than guessed together |
| `cadence.ts`                           | `isDue(item, today)`, `computeDueItems(repeatingItems, today)`                                                                                                                                                                               |
| `pantry.ts`                            | `matchAgainstPantry(item, pantryItems)` → `"exact" \| "partial" \| "none"` via normalized string equality/substring match only — no fuzzy-distance library in v1                                                                             |
| `history.ts`                           | `appendWeekRecord(items, weekOf)`, `detectRecurringCandidates(history, repeatingNames, threshold)`                                                                                                                                           |

All CLI wrappers parse args with Node's built-in `node:util.parseArgs` (no `commander`/`yargs` — unnecessary weight for a handful of scripts).

**Conversational/judgment logic → stays in `SKILL.md`, never becomes a script:**

- **Parsing pasted free-text recipes** (or, later, fetched URL content) into the structured `{name, servings, ingredients, steps}` shape — inherently unstructured; Claude does this directly, then calls `save-recipe.ts` to validate-and-persist the already-structured result. The script never attempts NLP parsing.
- **Conversational phrasing/ordering** — what to ask first, how to phrase "should I double this?", how to summarize coverage to the user.
- **Interpreting ambiguous pantry matches** — `pantry.ts` only classifies into `exact | partial | none`; deciding what to _do_ with a `"partial"` match (e.g. "chicken" vs "chicken thighs") is a judgment call left to `SKILL.md`.
- **HTML artifact composition/styling** — the CLI layer only ever produces the final structured JSON (`{weekOf, mealPlan, groceryList}`); Claude builds the actual HTML artifact via the Artifact tool, following `artifact-design` conventions. Presentation stays out of the tested deterministic core.
- **Error recovery / malformed input handling** mid-conversation.
- **(Deferred)** recipe URL fetching and extraction — `WebFetch` plus conversational parsing feeding the same `save-recipe.ts`; no new deterministic script.
- **(Deferred)** fuzzy pantry-matching UX, if added later on top of the `pantry.ts` tiers.

## 5. Skill design — `.claude/skills/plan-week/SKILL.md`

**Frontmatter** (approximate):

```yaml
---
name: plan-week
description: Plan the weekly meal plan and grocery list — collect/scale recipes, merge repeating and pantry-cadence items, cross-check against pantry, and produce an HTML artifact. Use when the user wants to plan meals for the week, build a grocery list, or review their pantry/repeating items.
---
```

**Invocation mechanism:** the skill calls scripts via the Bash tool as `npx tsx src/cli/<name>.ts <args>`, reads the JSON printed to stdout, and reasons over it conversationally. If `SKILL.md` grows past a comfortable size, per-script argument/output contracts move to `references/cli-scripts.md` and data schemas to `references/data-schemas.md`, loaded on demand — the top-level file stays focused on procedure.

**End-to-end conversational flow** (maps 1:1 to the product spec's user stories):

1. **Confirm defaults** — dinners-to-plan (default 6), eaters-per-dinner (default 2), whether to include non-dinner meals this week. Pure conversation, no script.
2. **Collect dinner recipes**, one slot at a time — reuse from the library (`load-recipes.ts` lists existing recipes to pick from), paste new recipe text (Claude parses conversationally → `save-recipe.ts` persists it), or manual/no-recipe entry (Claude collects ingredients+servings → `save-recipe.ts` with `noRecipe: true`).
3. **Check coverage per recipe** — `check-coverage.ts` (wraps `servings.ts`) compares recipe servings to eaters needed; if short, present `scaling.ts`'s suggested factor, confirm, apply via `scale-recipe.ts`. Track running coverage until dinners-needed is satisfied.
4. **Offer additional/non-dinner recipes** — same collection loop, `mealType` set accordingly.
5. **Build the grocery list** — `build-grocery-list.ts` merges all selected (scaled) recipe ingredients plus `due-items.ts` output (repeating items due per `cadence.ts`) into one deduped list.
6. **Pantry cross-check** — `check-pantry.ts` annotates the list with match tiers; Claude presents flagged items for the user to confirm/skip, never silently removing anything.
7. **Review/edit** — user adds/removes items conversationally; Claude maintains the structured list in-turn.
8. **Recurring-item detection** — `detect-recurring.ts` surfaces new items that have shown up repeatedly but aren't in `repeating.csv`; user confirms which to add; `update-repeating.ts` persists them.
9. **Generate the HTML artifact** — Claude builds it directly (via the Artifact tool, following `artifact-design` conventions) from the finalized `{mealPlan, groceryList}` JSON. The grocery list is grouped into five fixed categories, always in this order: Dairy, Meat, Fresh Fruit & Veg, Dry Pantry Items, Household Goods — using each item's stored `category` when it came from `repeating.csv`, and Claude's judgment when it came from a recipe. Items sourced from a repeating/cadence item are visually marked as repeats, distinct from one-off recipe items.
10. **Finalize** — `update-pantry.ts` upserts purchased items into `pantry.csv`, `update-repeating.ts` sets `last_purchased = today` for included cadence items, `append-history.ts` logs this week's item names to `history.json`.

A separate, smaller pantry-review sub-flow (reviewing/editing the pantry independent of weekly planning) reuses `pantryStore.ts`/`update-pantry.ts` directly and doesn't need its own script.

## 6. Phased stage breakdown

Every stage ends with Vitest unit tests plus an explicit manual verification step, before moving to the next stage.

**Stage 0 — Environment setup**

- Build: `package.json`, `tsconfig.json`, `.gitignore`; a trivial `src/lib/hello.ts` pure function + `hello.test.ts`; a trivial `src/cli/hello.ts` wrapper (using `node:util.parseArgs`) that prints JSON.
- Tests: Vitest unit test for the trivial function.
- Verify: `npm install && npm test` is green; `npx tsx src/cli/hello.ts --a 2 --b 3` prints valid JSON with the expected result.
- Exit criteria: toolchain fully functional with zero application logic yet.

**Stage 1 — MVP tracer bullet**

- Build: `types/index.ts` (Recipe, Ingredient), `recipes.ts` (load/list), 2–3 hand-written sample recipes under `data/recipes/`, `servings.ts` (`computeCoverage`), `grocery-list.ts` (`mergeIngredients`, exact-unit merge only at this stage), a `build-grocery-list.ts` CLI taking recipe ids + eaters/dinners and printing the deduped list + coverage summary. No skill, no pantry, no repeating, no scaling, no unit conversion yet.
- Tests: `mergeIngredients` (same name+unit sums; different units kept separate; case/whitespace normalization), `computeCoverage` (under/over/exact), recipe loading from fixture files.
- Verify: run the CLI against the sample recipes; hand-verify the deduped output.
- Exit criteria: the core "plan meals → deduped list" loop works end to end with real data.

**Stage 2 — SKILL.md orchestration**

- Build: `.claude/skills/plan-week/SKILL.md` wiring all prior stages into the conversational flow (§5).
- Tests: a non-interactive Vitest "smoke test" exercising the full lib pipeline (recipes → coverage → scaling → grocery-list → cadence → pantry) against fixture data in one call, as regression insurance for the logic the skill depends on.
- Verify: run the skill in Claude Code against a real week's recipes end to end; confirm each script call and its JSON output are sane.
- Exit criteria: a full conversational run produces a correct, sensible grocery list.

**Stage 3 — Grocery list review/edit + HTML artifact**

- Build: mostly `SKILL.md` instructions for conversational add/remove and artifact generation (per `artifact-design` conventions); optionally a small `finalize-list.ts` for shape validation. The artifact groups the grocery list into five fixed categories, always rendered in this order: **Dairy, Meat, Fresh Fruit & Veg, Dry Pantry Items, Household Goods**. Items sourced from `repeating.csv`/`due-items.ts` use their stored `category` field directly (§3); items sourced from recipe ingredients have no category field in the schema, so Claude assigns one by judgment at composition time (consistent with §4's "HTML artifact composition stays conversational" rule — tagging every recipe ingredient with a category up front isn't worth the added friction). Items that came from a repeating/cadence item rather than a recipe are visually marked as repeats (e.g. a small badge or icon) so the user can see at a glance which items are recurring purchases vs. one-off for this week's recipes.
- Tests: unit test for `finalize-list.ts` validation logic, if added.
- Verify: remove/add an item conversationally, confirm the final artifact reflects edits and renders the meal plan + grocery list clearly, grouped into the five fixed categories in order, with repeat items visibly marked. In early runs of this stage (before Stage 6 wires in repeating items), the repeat-marking simply has nothing to mark yet — no separate code path needed once Stage 6 lands.
- Exit criteria: artifact output satisfies the "Output HTML artifact" requirement, reflects user edits, sorts by the five-category taxonomy, and marks repeat items.

**Stage 4 — Recipe scaling**

- Build: `scaling.ts` (`scaleRecipe`, `determineScaleFactor`); wire into `build-grocery-list.ts`.
- Tests: amount multiplication (including non-numeric/"to taste" ingredients handled gracefully), scale-factor suggestion for exact and non-exact multiples.
- Verify: a 4-serving recipe with 6 eaters needed produces the expected suggested factor and correctly doubled amounts in the merged list.
- Exit criteria: scaling affects grocery-list math correctly and is unit-tested.

**Stage 5 — Unit conversion**

- Build: `units.ts` (volume + weight conversion tables, `toBase`/`fromBase`, display-unit selection); upgrade `grocery-list.ts` to convert within a unit family before summing.
- Tests: same-family conversion + sum (e.g. cups + pints), cross-family/unconvertible units kept separate, display-unit selection logic.
- Verify: a recipe list containing "2 cups" and "1 pint" of the same ingredient merges into one correct line item.
- Exit criteria: unit-aware merging is correct and unit-tested.

**Stage 6 — Repeating/cadence items**

- Build: `csv.ts` (generic read/write), `repeatingStore.ts`, `cadence.ts` (`isDue`/`computeDueItems`), seed `data/repeating.csv` with a starter list; extend `build-grocery-list.ts` to merge due items.
- Tests: `isDue` boundary cases (blank → always due, exactly N weeks, not yet due), CSV round-trip against temp fixture files (never the real `data/` files).
- Verify: a weekly item and an old 4-week item both appear; a recently-purchased cadence item is correctly excluded.
- Exit criteria: repeating/cadence items merge correctly and dedup alongside recipe-derived items.

**Stage 7 — Pantry cross-check**

- Build: `pantryStore.ts`, `pantry.ts` (`matchAgainstPantry` — exact/partial/none tiers), `check-pantry.ts` CLI.
- Tests: exact match, case/whitespace-insensitive match, partial/substring tier, no match; pantry CSV round-trip.
- Verify: seed `pantry.csv` with overlapping items, confirm correct tier annotations without items being silently removed.
- Exit criteria: pantry annotations are correct and non-destructive.

**Stage 8 — Pantry update + repeating cadence update**

- Build: `update-pantry.ts` (upsert purchased items into `pantry.csv`), `update-repeating.ts` (set `last_purchased = today` for included items only), plus a standalone pantry-review sub-flow in `SKILL.md`.
- Tests: upsert logic (new item added, existing amount updated, normalized-name matching), `last_purchased` updated only for included items.
- Verify: run the full flow to completion; inspect `pantry.csv`/`repeating.csv` afterward; run standalone pantry review separately.
- Exit criteria: files correctly reflect a completed week's shopping.

**Stage 9 — Recurring-item detection**

- Build: `history.ts` (`appendWeekRecord`, `detectRecurringCandidates`), `detect-recurring.ts` CLI, wire `append-history.ts` into the finalize step.
- Tests: item appearing in ≥3 of the last 4 weeks is flagged; item already in `repeating.csv` is excluded; item below threshold is not flagged; `appendWeekRecord` appends correctly without corrupting the file.
- Verify: simulate a few weeks of `history.json` with a recurring non-repeating item, run detection, confirm it's flagged and the skill offers to add it.
- Exit criteria: detection is correct and integrated into the weekly flow.

**Stage 10 — Deferred (explicitly out of scope for now)**

- Fuzzy pantry matching (e.g. a small library like `fuse.js`) to catch near-misses ("chix" vs "chicken") beyond the exact/substring tiers.
- Recipe entry via URL: fetch a recipe page and extract ingredients automatically (`WebFetch` + conversational parsing), feeding the existing `save-recipe.ts`. The recipe schema already carries `sourceUrl` in anticipation of this.
- Neither is required by any user story as MVP-critical; both are noted here so they aren't forgotten, not built now.

## 7. Next steps

Scaffold Stage 0, then proceed stage by stage per §6. Seed `data/repeating.csv` with a real starter list (user-provided; the product spec mentions seeding but doesn't supply the list).
