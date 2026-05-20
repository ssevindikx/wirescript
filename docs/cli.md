# CLI Reference

The `wirescript` CLI provides command-line access to the DB serialization layer.

## Installation

```sh
npm install -g wirescript
# or use via npx:
npx wirescript <command>

```

---

## Commands

### `compile` — DSL → DB JSON

Compiles a TypeScript DSL file and outputs the `WireScriptDb` JSON to stdout.

```sh
wirescript compile <file.ts>
wirescript compile circuit.ts > circuit.json
```

**Example:**
```sh
wirescript compile my-circuit.ts
# Output:
# {
#   "schema": "wirescript-db@v1",
#   "name": "LED Driver",
#   "components": [...],
#   "nodes": [...]
# }
```

The input file must export a `Schematic` as its default export:

```ts
// my-circuit.ts
import { Circuit, DC, R, LED, GND, RED } from 'wirescript';
export default Circuit('LED Driver', DC(5), R(330), LED(RED), GND());
```

---

### `decompile` — DB JSON → DSL code

Converts a `WireScriptDb` JSON file back to DSL or TypeScript code.

```sh
wirescript decompile <file.json>
wirescript decompile circuit.json
wirescript decompile circuit.json --format ts
wirescript decompile circuit.json --format dsl
```

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--format` | `dsl` | Output format: `dsl` or `ts` |
| `--import` | `wirescript` | Module import path (for `ts` format) |
| `--export` | `default` | Export name (for `ts` format) |

**Example:**
```sh
wirescript decompile circuit.json --format ts --export myCircuit
# Output:
# import { R, LED, GND, DC, createSchematic, ... } from 'wirescript';
# const s = createSchematic("LED Driver");
# ...
# export const myCircuit = s;
```

---

## Piping

The CLI is designed for pipeline use:

```sh
# Round-trip: DSL → JSON → TypeScript
wirescript compile circuit.ts | wirescript decompile /dev/stdin --format ts
```

---

## Programmatic usage

The CLI functions are also available as a library:

```ts
import { compileDslToDb, reverseDbToDsl } from 'wirescript';
```

See [Serialization](./serialization.md) for full API details.
