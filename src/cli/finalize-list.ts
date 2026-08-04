import fs from "node:fs";
import { parseArgs } from "node:util";
import { groupByCategory, validateFinalizedList } from "../lib/finalize-list.js";
import { parseJsonArg, runCli } from "./util.js";

const USAGE =
  "Usage: finalize-list.ts (--data '<JSON string of {weekOf, mealPlan, groceryList}>' | --dataFile <path>)";

runCli(() => {
  const { values } = parseArgs({
    options: {
      data: { type: "string" },
      dataFile: { type: "string" },
    },
  });

  if (!values.data && !values.dataFile) {
    console.error(USAGE);
    process.exit(1);
  }

  // --data-file avoids shell-quoting pitfalls (e.g. apostrophes in recipe/item names) that
  // --data's inline JSON string is exposed to; prefer it when the payload has any risky content.
  const raw = values.dataFile ? fs.readFileSync(values.dataFile, "utf-8") : (values.data as string);
  const parsed = parseJsonArg<unknown>("data", raw);

  const finalized = validateFinalizedList(parsed);
  const groupedGroceryList = groupByCategory(finalized.groceryList);

  console.log(
    JSON.stringify({
      weekOf: finalized.weekOf,
      mealPlan: finalized.mealPlan,
      groupedGroceryList,
    }),
  );
});
