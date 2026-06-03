#!/usr/bin/env node
/**
 * WireScript CLI - DSL<->DB conversions & Netlist import/export
 */

import { promises as fs } from 'fs';
import path from 'path';
import * as runtime from './index';
import { compileDslToDb, reverseDbToDsl, type WireScriptDb } from './db';
import { exportNetlist, importNetlist, type NetlistFormat } from './netlist';
import { Schematic } from './Schematic';

function printUsage(): void {
  console.log('Usage:');
  console.log('  wirescript compile      <input.js|input.dsl>  [--export name] [--out output.json]');
  console.log('  wirescript dsl2db       <input.js|input.dsl>  [--export name] [--out output.json]');
  console.log('  wirescript decompile    <input.json>          [--format dsl|ts] [--import module] [--export name] [--out output.dsl.js]');
  console.log('  wirescript db2dsl       <input.json>          [--format dsl|ts] [--import module] [--export name] [--out output.dsl.js]');
  console.log('  wirescript to-netlist   <input.json|input.js> [--format spice|ws-csv] [--title "..."] [--out output.net]');
  console.log('  wirescript from-netlist <input.net|input.csv> [--format spice|ws-csv] [--name "..."] [--out output.json]');
  console.log('');
  console.log('Aliases:');
  console.log('  compile     = dsl2db');
  console.log('  decompile   = db2dsl');
  console.log('  to-netlist  = netlist (db/dsl -> netlist)');
  console.log('  from-netlist = import-netlist (netlist -> db)');
}

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return undefined;
  }
  return args[index + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

async function loadSchematic(modulePath: string, exportName?: string): Promise<Schematic> {
  const absolutePath = path.resolve(modulePath);
  const source = await fs.readFile(absolutePath, 'utf-8');

  if (looksLikePlainDsl(source)) {
    return evaluatePlainDsl(source, absolutePath);
  }

  const mod = await import(absolutePath);
  const key = exportName ?? 'default';
  const exported = key === 'default' ? mod.default : mod[key];

  if (!exported) {
    throw new Error(`Export not found: ${key}`);
  }

  const value = typeof exported === 'function' ? exported() : exported;
  if (!(value instanceof Schematic)) {
    throw new Error('Export did not return a Schematic');
  }

  return value;
}

function looksLikePlainDsl(source: string): boolean {
  const hasModuleSyntax = /\bimport\b|\bexport\b|module\.exports|require\s*\(/.test(source);
  const hasCircuitCall = /\bCircuit\s*\(/.test(source);
  return !hasModuleSyntax && hasCircuitCall;
}

function evaluatePlainDsl(source: string, filePath: string): Schematic {
  const runtimeScope: Record<string, unknown> = { ...runtime };
  const baseCircuit = runtimeScope.Circuit as (...args: unknown[]) => Schematic;

  if (typeof baseCircuit !== 'function') {
    throw new Error('Runtime does not export Circuit()');
  }

  let captured: Schematic | undefined;
  runtimeScope.Circuit = (...args: unknown[]) => {
    const schematic = baseCircuit(...args);
    captured = schematic;
    return schematic;
  };

  const names = Object.keys(runtimeScope);
  const values = names.map(name => runtimeScope[name]);

  try {
    const evaluator = new Function(...names, `${source}\nreturn 0;`);
    evaluator(...values);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to evaluate plain DSL file ${filePath}: ${message}`);
  }

  if (!captured) {
    throw new Error(`Plain DSL file ${filePath} did not call Circuit(...)`);
  }

  return captured;
}

/** Detect whether a path is a DB JSON file or a DSL/TS module */
function isDbJsonPath(filePath: string): boolean {
  return /\.(json)$/i.test(filePath);
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || hasFlag(args, '--help') || hasFlag(args, '-h')) {
    printUsage();
    if (!command) process.exit(1);
    return;
  }

  // ── DSL → DB ──────────────────────────────────────────────────────────────
  if (command === 'dsl2db' || command === 'compile') {
    const inputPath = args[1];
    if (!inputPath) { printUsage(); process.exit(1); }

    const exportName = getArgValue(args, '--export');
    const outputPath = getArgValue(args, '--out');
    const schematic = await loadSchematic(inputPath, exportName);
    const db = compileDslToDb(schematic);
    const json = JSON.stringify(db, null, 2);

    if (outputPath) {
      await fs.writeFile(outputPath, json, 'utf-8');
      console.error(`Wrote DB JSON to ${outputPath}`);
    } else {
      console.log(json);
    }
    return;
  }

  // ── DB → DSL ──────────────────────────────────────────────────────────────
  if (command === 'db2dsl' || command === 'decompile') {
    const inputPath = args[1];
    if (!inputPath) { printUsage(); process.exit(1); }

    const outputPath = getArgValue(args, '--out');
    const format = getArgValue(args, '--format') ?? 'dsl';
    const moduleImport = getArgValue(args, '--import');
    const exportName = getArgValue(args, '--export');

    if (format !== 'dsl' && format !== 'ts') {
      throw new Error(`Invalid format: ${format}. Use --format dsl|ts`);
    }

    const raw = await fs.readFile(inputPath, 'utf-8');
    const db = JSON.parse(raw) as WireScriptDb;
    const dsl = reverseDbToDsl(db, {
      format,
      ...(moduleImport ? { moduleImport } : {}),
      ...(exportName ? { exportName } : {}),
    });

    if (outputPath) {
      await fs.writeFile(outputPath, dsl, 'utf-8');
      console.error(`Wrote DSL to ${outputPath}`);
    } else {
      console.log(dsl);
    }
    return;
  }

  // ── DSL/DB → Netlist ──────────────────────────────────────────────────────
  if (command === 'to-netlist' || command === 'netlist') {
    const inputPath = args[1];
    if (!inputPath) { printUsage(); process.exit(1); }

    const outputPath  = getArgValue(args, '--out');
    const format      = (getArgValue(args, '--format') ?? 'spice') as NetlistFormat;
    const title       = getArgValue(args, '--title');
    const exportName  = getArgValue(args, '--export');

    if (format !== 'spice' && format !== 'ws-csv') {
      throw new Error(`Invalid netlist format: ${format}. Use --format spice|ws-csv`);
    }

    let db: WireScriptDb;
    if (isDbJsonPath(inputPath)) {
      const raw = await fs.readFile(inputPath, 'utf-8');
      db = JSON.parse(raw) as WireScriptDb;
    } else {
      // Treat as DSL/TS module
      const schematic = await loadSchematic(inputPath, exportName);
      db = compileDslToDb(schematic);
    }

    const netlist = exportNetlist(db, {
      format,
      ...(title ? { title } : {}),
    });

    if (outputPath) {
      await fs.writeFile(outputPath, netlist, 'utf-8');
      console.error(`Wrote ${format} netlist to ${outputPath}`);
    } else {
      console.log(netlist);
    }
    return;
  }

  // ── Netlist → DB ──────────────────────────────────────────────────────────
  if (command === 'from-netlist' || command === 'import-netlist') {
    const inputPath = args[1];
    if (!inputPath) { printUsage(); process.exit(1); }

    const outputPath = getArgValue(args, '--out');
    const format     = getArgValue(args, '--format') as NetlistFormat | undefined;
    const name       = getArgValue(args, '--name');

    if (format && format !== 'spice' && format !== 'ws-csv') {
      throw new Error(`Invalid netlist format: ${format}. Use --format spice|ws-csv`);
    }

    const src = await fs.readFile(inputPath, 'utf-8');
    const db = importNetlist(src, {
      ...(format ? { format } : {}),
      ...(name   ? { name }   : {}),
    });

    const json = JSON.stringify(db, null, 2);
    if (outputPath) {
      await fs.writeFile(outputPath, json, 'utf-8');
      console.error(`Wrote DB JSON to ${outputPath}`);
    } else {
      console.log(json);
    }
    return;
  }

  printUsage();
  process.exit(1);
}

run().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
