import { parseArgs } from "node:util";
import { add } from "../lib/hello.js";

const { values } = parseArgs({
  options: {
    a: { type: "string" },
    b: { type: "string" },
  },
});

if (values.a === undefined || values.b === undefined) {
  console.error("Usage: hello.ts --a <number> --b <number>");
  process.exit(1);
}

const a = Number(values.a);
const b = Number(values.b);

console.log(JSON.stringify({ a, b, sum: add(a, b) }));
