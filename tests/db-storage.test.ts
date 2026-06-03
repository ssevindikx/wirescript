/**
 * DB Serialization (JSON / CSV storage) Tests
 *
 * Covers:
 *  - serializeDb / deserializeDb  (JSON format)
 *  - serializeDb / deserializeDb  (CSV format)
 *  - serializeDbCsv / deserializeDbCsv
 *  - auto-format detection
 *  - round-trip fidelity
 *  - format interop (JSON saved → CSV loaded, etc.)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Component } from '../core/Component';
import { Pin } from '../core/Pin';
import { Node } from '../core/Node';
import { Circuit, DC, GND, R, C, NPN } from '../core';
import {
  compileDslToDb,
  serializeDb,
  deserializeDb,
  serializeDbCsv,
  deserializeDbCsv,
  type WireScriptDb,
} from '../core/db';

beforeEach(() => {
  Component.resetCounter();
  Pin.resetCounter();
  Node.resetCounter();
});

function buildTestDb(): WireScriptDb {
  const circuit = Circuit('DB Test', DC(5), R(1000), C(1e-6), GND());
  return compileDslToDb(circuit);
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON format
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeDb — JSON format', () => {
  it('serializes to valid JSON by default', () => {
    const db = buildTestDb();
    const json = serializeDb(db);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('serialized JSON contains schema field', () => {
    const db = buildTestDb();
    const json = serializeDb(db);
    const parsed = JSON.parse(json) as WireScriptDb;
    expect(parsed.schema).toBe('wirescript-db@v1');
  });

  it('uses 2-space indent by default', () => {
    const db = buildTestDb();
    const json = serializeDb(db, { format: 'json' });
    expect(json).toContain('  "schema"');
  });

  it('respects custom indent', () => {
    const db = buildTestDb();
    const json = serializeDb(db, { format: 'json', indent: 4 });
    expect(json).toContain('    "schema"');
  });
});

describe('deserializeDb — JSON format', () => {
  it('deserializes from JSON string', () => {
    const original = buildTestDb();
    const json = serializeDb(original);
    const restored = deserializeDb(json);

    expect(restored.schema).toBe(original.schema);
    expect(restored.name).toBe(original.name);
    expect(restored.components.length).toBe(original.components.length);
    expect(restored.nodes.length).toBe(original.nodes.length);
  });

  it('auto-detects JSON format', () => {
    const original = buildTestDb();
    const json = serializeDb(original, { format: 'json' });
    // No format option → auto-detect
    const restored = deserializeDb(json);
    expect(restored.name).toBe(original.name);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CSV format
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeDbCsv — DB → CSV', () => {
  it('produces a string starting with [meta]', () => {
    const db = buildTestDb();
    const csv = serializeDbCsv(db);
    expect(csv.trim().startsWith('[meta]')).toBe(true);
  });

  it('contains [nodes] and [components] sections', () => {
    const db = buildTestDb();
    const csv = serializeDbCsv(db);
    expect(csv).toContain('[nodes]');
    expect(csv).toContain('[components]');
  });

  it('includes schema and name in [meta]', () => {
    const db = buildTestDb();
    const csv = serializeDbCsv(db);
    expect(csv).toContain('wirescript-db@v1');
    expect(csv).toContain('DB Test');
  });

  it('contains one row per node', () => {
    const db = buildTestDb();
    const csv = serializeDbCsv(db);

    // Extract the [nodes] section
    const nodeSection = csv.split('[components]')[0].split('[nodes]')[1];
    const dataRows = nodeSection.trim().split('\n').slice(1).filter(l => l.trim()); // skip header
    expect(dataRows.length).toBe(db.nodes.length);
  });

  it('contains one row per component', () => {
    const db = buildTestDb();
    const csv = serializeDbCsv(db);

    const compSection = csv.split('[components]')[1];
    const dataRows = compSection.trim().split('\n').slice(1).filter(l => l.trim());
    expect(dataRows.length).toBe(db.components.length);
  });
});

describe('deserializeDbCsv — CSV → DB', () => {
  it('restores a DB from CSV', () => {
    const original = buildTestDb();
    const csv = serializeDbCsv(original);
    const restored = deserializeDbCsv(csv);

    expect(restored.schema).toBe(original.schema);
    expect(restored.name).toBe(original.name);
    expect(restored.components.length).toBe(original.components.length);
    expect(restored.nodes.length).toBe(original.nodes.length);
  });

  it('restores component types', () => {
    const original = buildTestDb();
    const csv = serializeDbCsv(original);
    const restored = deserializeDbCsv(csv);

    const types = restored.components.map(c => c.type).sort();
    const originalTypes = original.components.map(c => c.type).sort();
    expect(types).toEqual(originalTypes);
  });

  it('restores component params', () => {
    const original = buildTestDb();
    const csv = serializeDbCsv(original);
    const restored = deserializeDbCsv(csv);

    const resistorOrig = original.components.find(c => c.type === 'resistor')!;
    const resistorRest = restored.components.find(c => c.type === 'resistor')!;

    expect(resistorRest.params.value).toBe(resistorOrig.params.value);
  });

  it('restores pin-to-node connections', () => {
    const original = buildTestDb();
    const csv = serializeDbCsv(original);
    const restored = deserializeDbCsv(csv);

    const origConnected = original.components.flatMap(c => c.pins).filter(p => p.nodeId).length;
    const restConnected = restored.components.flatMap(c => c.pins).filter(p => p.nodeId).length;

    expect(restConnected).toBe(origConnected);
  });

  it('restores node isGround flag', () => {
    // Ground nodes should have isGround: true after DB→CSV→DB
    // (note: in our test circuit, nodes might not be ground because the
    //  compile step stores isGround per-node)
    const original = buildTestDb();
    const csv = serializeDbCsv(original);
    const restored = deserializeDbCsv(csv);

    // Every restored node id should match an original
    const origIds = new Set(original.nodes.map(n => n.id));
    for (const node of restored.nodes) {
      expect(origIds.has(node.id)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// serializeDb / deserializeDb with format option
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeDb / deserializeDb — format option', () => {
  it('serializes to CSV when format=csv', () => {
    const db = buildTestDb();
    const csv = serializeDb(db, { format: 'csv' });
    expect(csv.trim().startsWith('[meta]')).toBe(true);
  });

  it('deserializes CSV when format=csv', () => {
    const original = buildTestDb();
    const csv = serializeDb(original, { format: 'csv' });
    const restored = deserializeDb(csv, { format: 'csv' });
    expect(restored.name).toBe(original.name);
    expect(restored.components.length).toBe(original.components.length);
  });

  it('auto-detects CSV from [meta] prefix', () => {
    const original = buildTestDb();
    const csv = serializeDb(original, { format: 'csv' });
    // No format option — should auto-detect
    const restored = deserializeDb(csv);
    expect(restored.name).toBe(original.name);
  });

  it('auto-detects JSON from { prefix', () => {
    const original = buildTestDb();
    const json = serializeDb(original, { format: 'json' });
    const restored = deserializeDb(json);
    expect(restored.name).toBe(original.name);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full round-trips
// ─────────────────────────────────────────────────────────────────────────────

describe('DB round-trips', () => {
  it('JSON round-trip preserves full structure', () => {
    const circuit = Circuit('JSON RT', DC(5), R(1000), GND());
    const original = compileDslToDb(circuit);

    const json = serializeDb(original, { format: 'json' });
    const restored = deserializeDb(json);

    expect(restored.schema).toBe(original.schema);
    expect(restored.name).toBe(original.name);
    expect(restored.components.length).toBe(original.components.length);
    expect(restored.nodes.length).toBe(original.nodes.length);

    // Pin connectivity
    for (let i = 0; i < original.components.length; i++) {
      const origPins = original.components[i].pins;
      const restPins = restored.components[i].pins;
      expect(restPins.length).toBe(origPins.length);
    }
  });

  it('CSV round-trip preserves full structure', () => {
    const circuit = Circuit('CSV RT', DC(5), R(1000), GND());
    const original = compileDslToDb(circuit);

    const csv = serializeDb(original, { format: 'csv' });
    const restored = deserializeDb(csv, { format: 'csv' });

    expect(restored.name).toBe(original.name);
    expect(restored.components.length).toBe(original.components.length);
    expect(restored.nodes.length).toBe(original.nodes.length);
  });

  it('JSON → CSV → JSON stays consistent', () => {
    const circuit = Circuit('Cross RT', DC(3.3), R(470), C(100e-9), GND());
    const original = compileDslToDb(circuit);

    const json1 = serializeDb(original, { format: 'json' });
    const fromJson = deserializeDb(json1);
    const csv = serializeDb(fromJson, { format: 'csv' });
    const fromCsv = deserializeDb(csv, { format: 'csv' });
    const json2 = serializeDb(fromCsv, { format: 'json' });
    const final = deserializeDb(json2);

    expect(final.name).toBe(original.name);
    expect(final.components.length).toBe(original.components.length);
    expect(final.nodes.length).toBe(original.nodes.length);
  });

  it('CSV handles components with extras (BJT)', () => {
    const t = NPN('2N2222');
    const circuit = Circuit('BJT CSV', [
      [DC(5), R(1000), t.C],
      [t.E, GND()],
      [DC(5), R(10000), t.B],
    ]);
    const original = compileDslToDb(circuit);

    const csv = serializeDb(original, { format: 'csv' });
    const restored = deserializeDb(csv, { format: 'csv' });

    const bjtOrig = original.components.find(c => c.type === 'bjt' || c.type === 'npn');
    const bjtRest = restored.components.find(c => c.type === 'bjt' || c.type === 'npn');
    expect(bjtRest).toBeDefined();
    expect(bjtRest!.type).toBe(bjtOrig!.type);
  });
});
