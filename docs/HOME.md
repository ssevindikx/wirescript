# WireScript Documentation

WireScript is a **code-first DSL** for describing electronic circuits in TypeScript.  
Its only job: *"which pin is connected to which node, and what is this component's physical parameter."*

---

## Table of Contents

| Guide | Description |
|---|---|
| [Getting Started](./getting-started.md) | Install, quick start, two API styles |
| [DSL API](./api-dsl.md) | Simplified declarative syntax — `Circuit`, `Series`, `Parallel` |
| [TypeScript API](./api-typescript.md) | Full imperative API — `createSchematic`, manual node/pin wiring |
| [Components](./components.md) | Every built-in component with parameters and examples |
| [Units](./units.md) | SI prefix helpers — `kOhm`, `uF`, `MHz`, etc. |
| [ERC](./erc.md) | Electrical Rule Check — physics-based static validation |
| [Serialization](./serialization.md) | DB layer, JSON IR, DSL ↔ DB round-trip |
| [IO & Formats](./io.md) | All three formats (`.ws`, netlist, DB) and conversion paths |
| [WireScript DSL (.ws)](./ws.md) | `.ws` file format — syntax, rules, API, CLI |
| [Netlist](./netlist.md) | SPICE netlist import/export |
| [CLI](./cli.md) | Command-line interface reference |
| [Examples](./examples.md) | Ready-to-run circuit examples |

---

## Two API Styles

WireScript offers two equivalent ways to describe circuits:

### 1. DSL API *(recommended)*
Declarative, concise. Best for most use cases.

```ts
import { Circuit, DC, R, LED, GND, RED } from '@ssevindikx/wirescript';

const circuit = Circuit('LED Driver', DC(5), R(330), LED(RED), GND());
```

### 2. TypeScript API *(full control)*
Imperative, explicit node/pin management. Best for complex topologies.

```ts
import { createSchematic, DC, R, LED, GND, RED } from '@ssevindikx/wirescript';

const s = createSchematic('LED Driver');
const src = DC(5), r = R(330), led = LED(RED), gnd = GND();

s.addComponents(src, r, led, gnd);

const n1 = s.createNode('net1');
const n2 = s.createNode('net2');

s.connect(src.positive, n1);
s.connect(r.p1, n1);
s.connect(r.p2, n2);
s.connect(led.anode, n2);
s.connect(led.cathode, gnd.getGroundNode());
s.connect(src.negative, gnd.getGroundNode());
```

Both produce identical internal representations.
