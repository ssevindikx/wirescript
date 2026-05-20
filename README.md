# WireScript

A **code-first DSL** for describing electronic circuits in TypeScript.

> ⚠️ Early experimental stage — API may change before stable release.

---

## Install

```sh
npm install @ssevindikx/wirescript
```

## Quick Start

```ts
import { Circuit, DC, R, LED, GND, RED, runERC } from '@ssevindikx/wirescript';

// Describe the circuit
const circuit = Circuit('LED Driver',
  DC(5),     // 5 V source
  R(330),    // 330 Ω current-limiting resistor
  LED(RED),  // Red LED
  GND()      // Ground reference
);

// Validate
const erc = runERC(circuit);
console.log(erc.summary()); // ✅ ERC passed — no violations found.

// Inspect
console.log(circuit.getSummary());
```

For multi-pin components (transistors, op-amps):

```ts
const t = NPN('2N2222');

Circuit('BJT Switch', [
  [DC(5), R(kOhm(1)), LED(RED), t.C],
  [t.E, GND()],
  [DC(5), R(kOhm(10)), t.B],
]);
```

---

## Documentation

| Guide | Description |
|---|---|
| [Getting Started](./docs/getting-started.md) | Install, quick start, two API styles |
| [DSL API](./docs/api-dsl.md) | Declarative syntax — `Circuit`, `Series`, `Parallel` |
| [TypeScript API](./docs/api-typescript.md) | Imperative API — `createSchematic`, manual wiring |
| [Components](./docs/components.md) | All built-in components with parameters |
| [Units](./docs/units.md) | SI prefix helpers — `kOhm`, `uF`, `MHz`, … |
| [ERC](./docs/erc.md) | Electrical Rule Check — physics-based validation |
| [Serialization](./docs/serialization.md) | JSON IR, DSL ↔ DB round-trip |
| [CLI](./docs/cli.md) | Command-line interface |
| [Examples](./docs/examples.md) | 12 ready-to-run circuit examples |

---

## Features

- **DSL API** — Declarative `Circuit`, `Series`, `Parallel` functions
- **TypeScript API** — Full `Schematic` / `Node` / `Pin` model
- **12 ERC rules** — Short circuit, polarity, fan-out, floating inputs, and more
- **Component library** — Resistors, capacitors, inductors, diodes, LEDs, BJTs, MOSFETs, op-amps, logic gates
- **SI unit helpers** — `kOhm`, `uF`, `mH`, `kHz`, `mA`, …
- **JSON serialization** — Save/load circuits as `wirescript-db@v1` JSON
- **CLI** — `wirescript compile` / `wirescript decompile`
- **163 tests** passing

---

## Run examples

```sh
npm install
npm run example
```

---

## License

MIT — See [LICENSE](./LICENSE).
