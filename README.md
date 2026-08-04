# Grocery List

A weekly meal-plan and grocery-list planner. You talk through the week's
dinners with Claude, it tracks whether you've planned enough to feed
everyone, merges the ingredients into one deduplicated shopping list, and
hands you back an HTML page with the meal plan and a categorized list you
can shop from.

There's no app to open and no server to run — the "app" is a
[Claude Code](https://claude.ai/code) skill backed by a small, tested
TypeScript library. You work entirely through a conversation with Claude.

## What it does today

- Plan dinners for the week (defaults: 6 dinners, 2 eaters/dinner), plus
  optional extras (breakfast, lunch, dessert, side).
- Reuse a saved recipe, paste a new one in, or enter a quick
  "no recipe needed" meal.
- Tracks running coverage as you add recipes, so you know when you've
  planned enough.
- Builds a deduplicated grocery list from every recipe's ingredients.
- Lets you review and edit the list conversationally before finalizing.
- Outputs an HTML artifact with the meal plan and the grocery list,
  grouped into five categories (Dairy, Meat, Fresh Fruit & Veg, Dry Pantry
  Items, Household Goods).

Not yet built: pantry cross-checking, recipe scaling, unit conversion, and
repeating/cadence items (e.g. "buy napkins every month"). The full staged
build plan lives in [`spec/tech-spec.md`](spec/tech-spec.md) §6; current
status is tracked in [`CLAUDE.md`](CLAUDE.md).

## Install

Requires Node 20+.

```
npm install
npm test          # confirm the test suite passes
```

That's the entire setup — there's no database, no server, and no
environment variables to configure. Data is stored as plain JSON/CSV files
under `data/`.

## Use it with Claude Code

1. Open this project's directory in [Claude Code](https://claude.ai/code)
   (CLI, desktop app, or web).
2. Start a conversation and ask Claude to plan your week (see prompts
   below). Claude picks up the `plan-week` skill automatically from
   `.claude/skills/plan-week/SKILL.md` — you don't need to invoke it by
   name.
3. Answer its questions as they come: how many dinners, which recipes,
   what to add or remove from the list.
4. When you confirm the list, Claude publishes an HTML artifact with your
   meal plan and shopping list.

You can also run any of the underlying scripts directly, without Claude,
if you just want the raw JSON:

```
npx tsx src/cli/load-recipes.ts
npx tsx src/cli/build-grocery-list.ts --recipe chicken-tacos --dinners 6 --eaters 2
```

## Sample prompts

**Start a week from scratch:**
> Let's plan meals for this week

**Answer the setup questions plainly, or skip straight to specifics:**
> 6 dinners, 2 people, no extras this week

**Reuse something you've cooked before:**
> Use the Chicken Tacos recipe again

**Add something new by pasting it in:**
> Here's a new one — Shepherd's Pie, serves 4. Ingredients: 1 lb ground
> lamb, 2 cups mashed potatoes, 1 cup peas, 1 onion, 2 tbsp butter. Steps:
> brown the lamb with onion, layer peas on top, cover with mashed
> potatoes, bake at 400°F for 25 min.

**A meal with no real recipe:**
> Grilled salmon, no recipe needed, serves 2

**Add a dessert or other extra:**
> Add a dessert too — chocolate mousse, serves 6, no recipe: dark
> chocolate, eggs, heavy cream

**Edit the list before finalizing:**
> Actually take the peas off, and add a dozen eggs and a bag of dinner
> rolls

**Wrap it up:**
> That looks good, finalize it

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npx tsx src/cli/<name>.ts [args]` | Run any CLI script directly, no build step |

## Learn more

- [`spec/grocery-list-spec.md`](spec/grocery-list-spec.md) — the product spec.
- [`spec/tech-spec.md`](spec/tech-spec.md) — architecture, data schemas, and
  the full staged build plan.
- [`CLAUDE.md`](CLAUDE.md) — current project status and conventions, for
  anyone (human or Claude) working on the code itself.
