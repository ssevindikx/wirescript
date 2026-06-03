# WireScript DSL Format (`.ws`)

`.ws` files are WireScript's native, human-readable circuit description format.  
They use plain `Circuit()` DSL syntax — no `import`/`export` statements.

---

## File Structure

```
// Optional header comments

<component_var> = <factory_function>
...

Circuit(
  "<circuit_name>",
  [
    [<pin1>, <pin2>, ...],   // Pins connected to the same node
    ...
  ]
)
```

### Example: LED Driver

```ws
// LED Driver Circuit
// Forward voltage: 2.1V, Max current: 20mA

V1 = DC(5)
R1 = R(330)
LED1 = LED("red")
GND1 = GND()

Circuit(
  "LED Driver",
  [
    [V1.p, R1.p1],
    [R1.p2, LED1.anode],
    [LED1.cathode, V1.n, GND1.gnd]
  ]
)
```

### Example: NPN Transistor Switch

```ws
V1 = DC(5)
R_collector = R(1000)
R_base = R(10000)
Q1 = NPN("2N2222")
LED1 = LED("red")
GND1 = GND()

Circuit(
  "NPN Switch",
  [
    [V1.p, R_collector.p1],
    [R_collector.p2, LED1.anode],
    [LED1.cathode, Q1.collector],
    [Q1.emitter, GND1.gnd],
    [V1.p, R_base.p1],
    [R_base.p2, Q1.base],
    [V1.n, GND1.gnd]
  ]
)
```

---

## Rules

| Rule | Description |
|---|---|
| ✅ `Circuit(...)` required | Every `.ws` file must contain at least one `Circuit()` call |
| ✅ All component factories available | `R()`, `C()`, `DC()`, `NPN()`, `OpAmp()`, etc. |
| ✅ Line comments with `//` | Standard JS comment syntax |
| ❌ No `import` | `.ws` files must not contain module syntax |
| ❌ No `export` | Output is taken directly from the `Circuit()` call |
| ❌ No `require()` | Plain DSL syntax only |

---

## API

```ts
import { exportWs, importWs } from '@ssevindikx/wirescript';

// DB → .ws string
const wsCode = exportWs(db);
const wsCode = exportWs(db, {
  header: ['Auto-generated', `Date: ${new Date().toISOString()}`],
});

// .ws string → DB
const db = importWs(wsSource);
const db = importWs(wsSource, { name: 'My Circuit' });
```

### `WsExportOptions`

```ts
interface WsExportOptions {
  /** Header comment lines (each becomes // ...) */
  header?: string[];
}
```

### `WsImportOptions`

```ts
interface WsImportOptions {
  /** Override the schematic name */
  name?: string;
}
```

### Aliases

```ts
import { dbToWs, wsToDb, db2ws, ws2db } from '@ssevindikx/wirescript';
```

---

## CLI

```sh
# Generate .ws from any format
wirescript convert circuit.json --to ws --out circuit.ws
wirescript convert circuit.net --to ws --out circuit.ws

# Shorthand
wirescript to-ws circuit.json --out circuit.ws
wirescript to-ws circuit.net

# .ws → DB JSON
wirescript from-ws circuit.ws --out circuit.json

# .ws → SPICE netlist (ws → DB → netlist)
wirescript convert circuit.ws --to netlist --out circuit.net
```

---

## Round-trip

The `.ws` format supports full round-trips:

```ts
import { Circuit, DC, R, GND, compileDslToDb, exportWs, importWs } from '@ssevindikx/wirescript';

// Original circuit
const circuit = Circuit('Test', DC(5), R(1000), GND());
const original = compileDslToDb(circuit);

// DB → .ws → DB
const wsCode  = exportWs(original);
const rebuilt = importWs(wsCode);

console.log(rebuilt.components.length === original.components.length); // true
console.log(rebuilt.name === original.name);                           // true
```

---

See [IO & Formats](./io.md) and [CLI Reference](./cli.md) for more.
