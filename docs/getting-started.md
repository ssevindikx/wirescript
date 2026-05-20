# Getting Started

## Installation

```sh
npm install wirescript
```

## Requirements

- Node.js 18+
- TypeScript 5+ (optional but recommended)

---

## Quick Start

### DSL style (recommended)

```ts
import { Circuit, DC, R, LED, GND, RED, runERC } from 'wirescript';

// Describe the circuit
const circuit = Circuit('LED Driver',
  DC(5),    // 5 V source
  R(330),   // 330 Ω current-limiting resistor
  LED(RED), // Red LED
  GND()     // Ground reference
);

// Inspect
console.log(circuit.getSummary());

// Validate structure
const validation = circuit.validate();
console.log(validation); // { valid: true, errors: [], warnings: [] }

// Electrical rule check
const erc = runERC(circuit);
console.log(erc.summary()); // ✅ ERC passed — no violations found.
```

### TypeScript style (full control)

```ts
import { createSchematic, DC, R, LED, GND, RED } from 'wirescript';

const s = createSchematic('LED Driver');

const src = DC(5);
const r   = R(330);
const led = LED(RED);
const gnd = GND();

s.addComponents(src, r, led, gnd);

const n1 = s.createNode();
const n2 = s.createNode();

s.connect(src.positive,  n1);
s.connect(r.p1,          n1);
s.connect(r.p2,          n2);
s.connect(led.anode,     n2);
s.connect(led.cathode,   gnd.getGroundNode());
s.connect(src.negative,  gnd.getGroundNode());
```

---

## Run the built-in examples

```sh
npm run example
```

---

## Next Steps

| I want to… | Go to |
|---|---|
| Learn the declarative syntax | [DSL API](./api-dsl.md) |
| Wire complex circuits manually | [TypeScript API](./api-typescript.md) |
| See all available components | [Components](./components.md) |
| Check my circuit for electrical errors | [ERC](./erc.md) |
| Export/import circuits as JSON | [Serialization](./serialization.md) |
| Use the command line | [CLI](./cli.md) |
