# Examples

Run all examples locally:

```sh
npm run example
```

---

## 1. Simple LED Circuit

**DC source → Resistor → LED → Ground**

```ts
import { Circuit, DC, R, LED, GND, RED } from '@ssevindikx/wirescript';

const circuit = Circuit('LED Blinker',
  DC(5),
  R(330),
  LED(RED),
  GND()
);

console.log(circuit.getSummary());
// Circuit: LED Blinker
// Components: 4
// ...
```

---

## 2. Voltage Divider

**Two resistors creating Vout = Vin × R2 / (R1 + R2)**

```ts
import { createSchematic, Series, applyToCircuit, DC, R, GND, kOhm } from '@ssevindikx/wirescript';

const s = createSchematic('Voltage Divider');

// 12V source, two 10kΩ resistors → 6V at midpoint
const result = Series(DC(12), R(kOhm(10)), R(kOhm(10)), GND());
applyToCircuit(s, result);

// Midpoint is r1.p2 (= r2.p1), accessible as the node between them
```

---

## 3. Parallel Resistors

```ts
import { Circuit, DC, Parallel, R, GND } from '@ssevindikx/wirescript';

// Equivalent resistance: 1/R_eq = 1/1k + 1/2k + 1/3k ≈ 545 Ω
const circuit = Circuit('Parallel Resistors',
  DC(9),
  Parallel(R(1000), R(2000), R(3000)),
  GND()
);
```

---

## 4. RC Low-Pass Filter

**f_c = 1 / (2π × R × C) ≈ 1.6 kHz**

```ts
import { Circuit, AC, R, C, GND, kOhm, uF, kHz } from '@ssevindikx/wirescript';

const circuit = Circuit('RC Low-Pass Filter',
  AC(5, kHz(10)),   // Input signal
  R(kOhm(1)),       // 1 kΩ
  C(uF(0.1)),       // 100 nF → fc ≈ 1.6 kHz
  GND()
);
```

---

## 5. LC Tank Circuit (Resonant)

**f_r = 1 / (2π × √(LC)) ≈ 15.9 kHz**

```ts
import { Circuit, DC, Parallel, Series, R, L, C, GND, mH, uF } from '@ssevindikx/wirescript';

const circuit = Circuit('LC Tank',
  DC(12),
  R(100),                          // Damping resistor
  Parallel(L(mH(10)), C(uF(1))),  // Resonant tank
  GND()
);
```

---

## 6. Traffic Light (Multiple LEDs in parallel)

```ts
import { Circuit, DC, Series, Parallel, R, LED, GND, RED, GREEN, BLUE } from '@ssevindikx/wirescript';

const circuit = Circuit('Traffic Light',
  DC(5),
  Parallel(
    Series(R(220), LED(RED)),
    Series(R(220), LED(GREEN)),
    Series(R(180), LED(BLUE))
  ),
  GND()
);
```

---

## 7. BJT Switch (NPN)

**Transistor switching an LED on/off via base drive**

```ts
import { Circuit, DC, R, LED, GND, NPN, kOhm, RED } from '@ssevindikx/wirescript';

const t = NPN('2N2222');

const circuit = Circuit('BJT Switch', [
  [DC(5), R(kOhm(1)), LED(RED), t.C],   // Collector: LED load
  [t.E, GND()],                          // Emitter to GND
  [DC(5), R(kOhm(10)), t.B],            // Base drive (Ib ≈ 0.43 mA)
]);
```

---

## 8. Inverting Op-Amp Amplifier

**Gain = −Rf/Rin = −10**

```ts
import { Circuit, AC, R, GND, VCC, VNEG, OpAmp, kOhm } from '@ssevindikx/wirescript';

const op = OpAmp('LM741');

const circuit = Circuit('Inverting Amplifier', [
  [VCC(15),   op.vPos],                              // Positive supply
  [VNEG(-15), op.vNeg],                              // Negative supply
  [AC(0.1, 1000), R(kOhm(10)), op.inN],             // Input (Rin = 10kΩ)
  [op.out, R(kOhm(100)), op.inN],                    // Feedback (Rf = 100kΩ)
  [op.inP, GND()],                                   // Non-inverting tied to GND
]);
```

---

## 9. SR Latch (NAND gates)

**Set/Reset flip-flop using cross-coupled NAND gates**

```ts
import { Circuit, HIGH, NAND } from '@ssevindikx/wirescript';

const nand1 = NAND();
const nand2 = NAND();

const srLatch = Circuit('SR Latch', { autoGround: false }, [
  [HIGH(), nand1.A],          // S input (active low)
  [nand2.Y, nand1.B],         // Q̄ → NAND1 input B (cross-feedback)
  [nand1.Y, nand2.A],         // Q  → NAND2 input A (cross-feedback)
  [HIGH(), nand2.B],          // R input (active low)
]);
// nand1.Y = Q, nand2.Y = Q̄
```

---

## 10. Full-Wave Bridge Rectifier

**Converts AC to pulsed DC using 4 diodes**

```ts
import { createSchematic, AC, D, R, C, GND } from '@ssevindikx/wirescript';

const s = createSchematic('Bridge Rectifier');
const src = AC(12, 60);
const [d1, d2, d3, d4] = [D('1N4007'), D('1N4007'), D('1N4007'), D('1N4007')];
const load = R(1000), cap = C(100e-6), gnd = GND();

s.addComponents(src, d1, d2, d3, d4, load, cap, gnd);

const acP = s.createNode('AC+'), acN = s.createNode('AC-');
const dcP = s.createNode('DC+'), dcN = s.createNode('DC-');

s.connect(src.positive, acP);  s.connect(src.negative, acN);

s.connect(d1.anode, acP);  s.connect(d1.cathode, dcP);
s.connect(d2.anode, dcN);  s.connect(d2.cathode, acP);
s.connect(d3.anode, acN);  s.connect(d3.cathode, dcP);
s.connect(d4.anode, dcN);  s.connect(d4.cathode, acN);

s.connect(load.p1, dcP);  s.connect(load.p2, dcN);
s.connect(cap.p1,  dcP);  s.connect(cap.p2,  dcN);
s.connect(gnd.gnd, dcN);

console.log(s.getSummary());
```

---

## 11. Using ERC with any circuit

```ts
import { Circuit, DC, R, LED, GND, RED, runERC } from '@ssevindikx/wirescript';

const circuit = Circuit('LED Driver', DC(5), R(330), LED(RED), GND());
const result = runERC(circuit);

console.log(result.summary());
// ✅ ERC passed — no violations found.

// Example with a fault:
const bad = Circuit('Short', DC(5), GND());
const faults = runERC(bad);
console.log(faults.summary());
// ERC Result: 1 error(s), 0 warning(s), 0 info(s)
//
// 🔴 [ERC_SHORT_CIRCUIT] V1: positive and negative terminals are short-circuited...
```

---

## 12. Serialization round-trip

```ts
import { Circuit, DC, R, GND, compileDslToDb, reverseDbToDsl } from '@ssevindikx/wirescript';

const original = Circuit('Test', DC(5), R(1000), GND());

// Serialize
const db = compileDslToDb(original);
const json = JSON.stringify(db, null, 2);
console.log(json);

// Deserialize back to code
const code = reverseDbToDsl(JSON.parse(json), { format: 'dsl' });
console.log(code);
```
