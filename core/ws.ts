/**
 * WireScript Core - WireScript DSL (.ws) Import / Export
 *
 * The .ws format is WireScript's native human-readable circuit description language.
 * It uses the plain Circuit() DSL syntax — no TypeScript module syntax.
 *
 * Example .ws file:
 * -----------------
 *   R1 = R(1000)
 *   C1 = C(1e-6)
 *   V1 = DC(5)
 *   GND1 = GND()
 *
 *   Circuit(
 *     "RC Filter",
 *     [
 *       [V1.p, R1.p1],
 *       [R1.p2, C1.p1],
 *       [C1.p2, V1.n, GND1.gnd]
 *     ]
 *   )
 *
 * Entry points
 * ------------
 *   exportWs(db, options?)   — WireScriptDb → .ws string
 *   importWs(src, options?)  — .ws string  → WireScriptDb
 *
 *   dbToWs / wsToDb          — preferred alias names
 */

import * as runtime from './index';
import { Circuit } from './dsl';
import { Schematic } from './Schematic';
import { compileDslToDb, reverseDbToDsl, type WireScriptDb } from './db';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/** Options for `exportWs`. */
export interface WsExportOptions {
  /**
   * A header comment block emitted at the top of the .ws file.
   * Each string in the array becomes one comment line.
   */
  header?: string[];
}

/** Options for `importWs`. */
export interface WsImportOptions {
  /**
   * Override the schematic name.
   * Defaults to the name used inside the Circuit() call.
   */
  name?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Export: DB → .ws
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a `WireScriptDb` to a `.ws` (WireScript DSL) string.
 *
 * The output is a valid `.ws` file that can be re-imported with `importWs`.
 *
 * @example
 * const ws = exportWs(db);
 * await fs.writeFile('circuit.ws', ws, 'utf-8');
 */
export function exportWs(db: WireScriptDb, options: WsExportOptions = {}): string {
  const lines: string[] = [];

  // Header comment block
  if (options.header && options.header.length > 0) {
    for (const line of options.header) {
      lines.push(`// ${line}`);
    }
    lines.push('');
  }

  // Generate the plain DSL body
  const body = reverseDbToDsl(db, { format: 'dsl' });
  lines.push(body);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Import: .ws → DB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a `.ws` (WireScript DSL) string and return a `WireScriptDb`.
 *
 * The `.ws` source must contain a `Circuit(...)` call.
 * No `import` / `export` / `require` statements are allowed — those belong in
 * `.ts` files. Use `Circuit()`, component factories, and pin accessors directly.
 *
 * @throws If the source contains module syntax or no `Circuit(...)` call is found.
 *
 * @example
 * const src = await fs.readFile('circuit.ws', 'utf-8');
 * const db = importWs(src);
 */
export function importWs(src: string, options: WsImportOptions = {}): WireScriptDb {
  // Validate: .ws files must NOT contain module syntax
  if (/\bimport\b|\bexport\b|module\.exports|require\s*\(/.test(src)) {
    throw new Error(
      '.ws files must not contain import/export/require statements. ' +
      'Use plain WireScript DSL syntax (Circuit(), R(), DC(), etc.).',
    );
  }

  if (!/\bCircuit\s*\(/.test(src)) {
    throw new Error(
      '.ws file must contain a Circuit(...) call.',
    );
  }

  // Build a runtime scope with all WireScript exports available
  const runtimeScope: Record<string, unknown> = { ...runtime };
  const baseCircuit = Circuit as (...args: unknown[]) => Schematic;
  let captured: Schematic | undefined;

  // Wrap Circuit() to capture the result
  runtimeScope['Circuit'] = (...args: unknown[]) => {
    const schematic = baseCircuit(...(args as Parameters<typeof Circuit>));
    captured = schematic;
    return schematic;
  };

  const names = Object.keys(runtimeScope);
  const values = names.map(n => runtimeScope[n]);

  try {
    const evaluator = new Function(...names, `${src}\nreturn 0;`);
    evaluator(...values);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to evaluate .ws source: ${msg}`);
  }

  if (!captured) {
    throw new Error('.ws source did not call Circuit(...)');
  }

  // Override name if requested
  if (options.name) {
    (captured as unknown as { name: string }).name = options.name;
  }

  return compileDslToDb(captured);
}

// ─────────────────────────────────────────────────────────────────────────────
// Aliases
// ─────────────────────────────────────────────────────────────────────────────

/** Alias: `WireScriptDb` → `.ws` string */
export const dbToWs = exportWs;

/** Alias: `.ws` string → `WireScriptDb` */
export const wsToDb = importWs;

/** Alias: `WireScriptDb` → `.ws` string */
export const db2ws = exportWs;

/** Alias: `.ws` string → `WireScriptDb` */
export const ws2db = importWs;
