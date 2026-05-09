# CLI Reference

The `wirelang` CLI provides command-line access to the DB serialization layer.

## Installation

```sh
npm install -g wirelang
# or use via npx:
npx wirelang <command>
```

---

## Commands

### `compile` — DSL → DB JSON

Compiles a TypeScript DSL file and outputs the `WireLangDb` JSON to stdout.

```sh
wirelang compile <file.ts>
wirelang compile circuit.ts > circuit.json
```

**Example:**
```sh
wirelang compile my-circuit.ts
# Output:
# {
#   "schema": "wirelang-db@v1",
#   "name": "LED Driver",
#   "components": [...],
#   "nodes": [...]
# }
```

The input file must export a `Schematic` as its default export:

```ts
// my-circuit.ts
import { Circuit, DC, R, LED, GND, RED } from 'wirelang';
export default Circuit('LED Driver', DC(5), R(330), LED(RED), GND());
```

---

### `decompile` — DB JSON → DSL code

Converts a `WireLangDb` JSON file back to DSL or TypeScript code.

```sh
wirelang decompile <file.json>
wirelang decompile circuit.json
wirelang decompile circuit.json --format ts
wirelang decompile circuit.json --format dsl
```

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--format` | `dsl` | Output format: `dsl` or `ts` |
| `--import` | `wirelang` | Module import path (for `ts` format) |
| `--export` | `default` | Export name (for `ts` format) |

**Example:**
```sh
wirelang decompile circuit.json --format ts --export myCircuit
# Output:
# import { R, LED, GND, DC, createSchematic, ... } from 'wirelang';
# const s = createSchematic("LED Driver");
# ...
# export const myCircuit = s;
```

---

## Piping

The CLI is designed for pipeline use:

```sh
# Round-trip: DSL → JSON → TypeScript
wirelang compile circuit.ts | wirelang decompile /dev/stdin --format ts
```

---

## Programmatic usage

The CLI functions are also available as a library:

```ts
import { compileDslToDb, reverseDbToDsl } from 'wirelang';
```

See [Serialization](./serialization.md) for full API details.
