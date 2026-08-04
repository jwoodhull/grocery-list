import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseJsonArg, parseNumberArg, runCli } from "./util.js";

/** Thrown by the mocked `process.exit` so a real exit-triggering call still halts the function under test. */
class ProcessExitCalled extends Error {
  constructor(public code: number | undefined) {
    super(`process.exit(${code}) called`);
  }
}

describe("cli/util", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ProcessExitCalled(code);
    }) as never);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe("parseJsonArg", () => {
    it("parses valid JSON", () => {
      expect(parseJsonArg<{ a: number }>("data", '{"a":1}')).toEqual({ a: 1 });
    });

    it("prints an error naming the flag and exits 1 on invalid JSON", () => {
      expect(() => parseJsonArg("data", "{ not json")).toThrow(ProcessExitCalled);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/--data must be valid JSON/));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("parseNumberArg", () => {
    it("parses a valid number string", () => {
      expect(parseNumberArg("dinners", "6")).toBe(6);
    });

    it("prints an error naming the flag and value, and exits 1, for a non-numeric string", () => {
      expect(() => parseNumberArg("dinners", "abc")).toThrow(ProcessExitCalled);
      expect(errorSpy).toHaveBeenCalledWith('Error: --dinners must be a number, got "abc"');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("exits 1 for a non-finite value like Infinity", () => {
      expect(() => parseNumberArg("dinners", "Infinity")).toThrow(ProcessExitCalled);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("runCli", () => {
    it("runs the callback and touches neither stderr nor process.exit on success", () => {
      const main = vi.fn();
      runCli(main);
      expect(main).toHaveBeenCalledOnce();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("prints 'Error: <message>' and exits 1 when the callback throws", () => {
      expect(() =>
        runCli(() => {
          throw new Error("boom");
        }),
      ).toThrow(ProcessExitCalled);
      expect(errorSpy).toHaveBeenCalledWith("Error: boom");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
