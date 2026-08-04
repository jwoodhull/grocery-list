/**
 * Parses a CLI flag's raw string value as JSON, printing a clear error and exiting non-zero
 * (rather than throwing a raw SyntaxError) if it isn't valid JSON.
 *
 * @param flagName - The flag's name (without leading `--`), used in the error message.
 * @param raw - The raw string value passed for the flag.
 * @returns The parsed value, cast to `T`.
 */
export function parseJsonArg<T>(flagName: string, raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error: --${flagName} must be valid JSON (${(err as Error).message})`);
    process.exit(1);
  }
}

/**
 * Parses a CLI flag's raw string value as a number, printing a clear error and exiting
 * non-zero if it isn't one.
 *
 * @param flagName - The flag's name (without leading `--`), used in the error message.
 * @param raw - The raw string value passed for the flag.
 * @returns The parsed number.
 */
export function parseNumberArg(flagName: string, raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.error(`Error: --${flagName} must be a number, got "${raw}"`);
    process.exit(1);
  }
  return value;
}

/**
 * Runs a CLI script's body, printing `Error: <message>` to stderr and exiting non-zero if it
 * throws — the shared error-reporting convention every `/src/cli` script follows.
 *
 * @param main - The script's body.
 */
export function runCli(main: () => void): void {
  try {
    main();
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}
