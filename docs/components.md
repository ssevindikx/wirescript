# Components Reference

All components are importable from `'wirelang'`.  
Every component has:
- An auto-generated `label` (`R1`, `C2`, `Q1`, …)
- A `validate()` method returning `string[]` errors
- A `toString()` producing a human-readable description

---

## Passive Components

### Resistor — `R(value)`

```ts
import { R, kOhm, MOhm } from 'wirelang';

const r1 = R(330);           // 330 Ω
const r2 = R(kOhm(4.7));    // 4.7 kΩ
const r3 = R(MOhm(1));      // 1 MΩ
```

| Pin | Name | Description |
|---|---|---|
| `p1` | `'1'` | Terminal 1 |
| `p2` | `'2'` | Terminal 2 |

**Params:** `resistance` (Ω), `value` (same), `unit: 'Ω'`  
**Validation:** `resistance > 0`

---

### Capacitor — `C(value)`

```ts
import { C, uF, nF, pF } from 'wirelang';

const c1 = C(uF(100));   // 100 µF
const c2 = C(nF(10));    // 10 nF
const c3 = C(pF(22));    // 22 pF
```

| Pin | Name |
|---|---|
| `p1` | `'1'` |
| `p2` | `'2'` |

**Params:** `capacitance` (F), `unit: 'F'`

---

### Inductor — `L(value)`

```ts
import { L, mH, uH } from 'wirelang';

const l1 = L(mH(10));    // 10 mH
const l2 = L(uH(470));   // 470 µH
```

| Pin | Name |
|---|---|
| `p1` | `'1'` |
| `p2` | `'2'` |

**Params:** `inductance` (H), `unit: 'H'`

---

## Diodes

### Diode — `D(params?)`

```ts
import { D } from 'wirelang';

const d1 = D();                          // Generic (Vf=0.7V)
const d2 = D('1N4148');                 // By part number
const d3 = D({ forwardVoltage: 0.4, maxCurrent: 0.1 });
```

| Pin | Name | Description |
|---|---|---|
| `anode` | `'anode'` | Positive terminal |
| `cathode` | `'cathode'` | Negative terminal |

**Params:**
| Field | Default | Description |
|---|---|---|
| `forwardVoltage` | `0.7` | V |
| `maxCurrent` | `1.0` | A |
| `partNumber` | `undefined` | e.g. `'1N4148'` |

---

### LED — `LED(color?)` / `LED(params?)`

```ts
import { LED, RED, GREEN, BLUE, YELLOW, WHITE, ORANGE, PURPLE, CYAN, PINK, AMBER, IR, UV } from 'wirelang';

const led1 = LED(RED);
const led2 = LED(BLUE);
const led3 = LED({ color: GREEN, forwardVoltage: 2.1, maxCurrent: 0.02 });
```

| Pin | Name |
|---|---|
| `anode` | `'anode'` |
| `cathode` | `'cathode'` |

**Default forward voltages by color:**

| Color | Vf (V) | If_max (mA) |
|---|---|---|
| Red | 1.8 | 20 |
| Orange / Amber | 2.0 | 20 |
| Yellow | 2.1 | 20 |
| Green | 2.2 | 20 |
| White | 3.0 | 20 |
| Blue / Purple / Cyan / Pink | 3.2 | 20 |
| IR | 1.2 | 20 |
| UV | 3.4 | 20 |

---

## Voltage Sources

### DC Voltage Source — `DC(voltage)`

```ts
import { DC } from 'wirelang';

const src = DC(5);    // 5 V DC
const src = DC(3.3);  // 3.3 V DC
```

| Pin | Name | Direction |
|---|---|---|
| `positive` (`p`) | `'positive'` | Output |
| `negative` (`n`) | `'negative'` | Input |

---

### AC Voltage Source — `AC(voltage, frequency?)`

```ts
import { AC, kHz } from 'wirelang';

const src = AC(12, 60);         // 12 Vrms @ 60 Hz
const src = AC(1, kHz(10));     // 1 Vrms @ 10 kHz
```

**Params:** `voltage` (V), `frequency` (Hz), `sourceType: 'ac'`

---

### DC Current Source — `IDC(current)`

```ts
import { IDC, mA } from 'wirelang';

const i = IDC(mA(10));   // 10 mA DC current source
```

| Pin | Name |
|---|---|
| `positive` (`p`) | `'positive'` |
| `negative` (`n`) | `'negative'` |

---

### AC Current Source — `IAC(current, frequency?)`

```ts
import { IAC, mA, kHz } from 'wirelang';

const i = IAC(mA(1), kHz(1));
```

---

### Ground — `GND()`

```ts
import { GND } from 'wirelang';

const gnd = GND();
gnd.gnd              // Pin
gnd.getGroundNode()  // Node (isGround() === true)
```

---

## Power Rails

Ideal voltage rails (zero source impedance assumed).

```ts
import { VCC, VDD, VPOS, VNEG } from 'wirelang';

VCC(5)      // +5 V digital supply
VDD(3.3)    // +3.3 V (common for MCUs)
VPOS(15)    // +15 V (op-amp positive rail)
VNEG(-15)   // −15 V (op-amp negative rail)
```

Each has a single pin (`p1`) connected to the rail voltage.

---

## Transistors

### NPN BJT — `NPN(params?)`

```ts
import { NPN } from 'wirelang';

const t = NPN();              // Generic NPN
const t = NPN('2N2222');     // By model name
const t = NPN({ model: 'BC547', hfe: 200, vce_sat: 0.2, vbe: 0.7 });
```

| Pin | Name | Description |
|---|---|---|
| `B` | `'B'` | Base (control) |
| `C` | `'C'` | Collector |
| `E` | `'E'` | Emitter |

**Supported models:** `2N2222`, `2N3904`, `BC547`, `BC548`, `generic`

**Params:** `hfe` (β, current gain), `vce_sat` (V), `vbe` (V)

---

### PNP BJT — `PNP(params?)`

Same interface as `NPN`. Supported models: `2N2907`, `2N3906`, `BC557`, `generic`.

```ts
const t = PNP('2N2907');
t.B  // base
t.C  // collector
t.E  // emitter
```

---

### N-Channel MOSFET — `NMOS(params?)`

```ts
import { NMOS } from 'wirelang';

const m = NMOS();
const m = NMOS('2N7000');
const m = NMOS({ model: 'IRF540', vth: 3.0, rds_on: 0.077, id_max: 28 });
```

| Pin | Name | Description |
|---|---|---|
| `G` | `'G'` | Gate (control) |
| `D` | `'D'` | Drain |
| `S` | `'S'` | Source |

**Params:** `vth` (threshold V), `rds_on` (Ω), `id_max` (A)

---

### P-Channel MOSFET — `PMOS(params?)`

Same interface as `NMOS`.

---

## Op-Amps

### 5-pin Op-Amp — `OpAmp(partNumber?)`

Full op-amp with supply pins. Use when power supply connections matter.

```ts
import { OpAmp, LM741, TL072, NE5532, LM358 } from 'wirelang';

const op = OpAmp();           // Generic
const op = OpAmp('LM741');   // Specific part
const op = LM741();           // Shorthand preset
```

| Pin | Name | Description |
|---|---|---|
| `inP` | `'inP'` | Non-inverting input (+) |
| `inN` | `'inN'` | Inverting input (−) |
| `out` | `'out'` | Output |
| `vPos` | `'vPos'` | Positive supply (V+) |
| `vNeg` | `'vNeg'` | Negative supply (V−) |

**Presets:** `LM741()`, `TL072()`, `NE5532()`, `LM358()`

**Full circuit example:**
```ts
const op = OpAmp('LM741');
Circuit('Inverting Amp', [
  [VCC(15),   op.vPos],
  [VNEG(-15), op.vNeg],
  [AC(0.1, 1000), R(kOhm(10)), op.inN],
  [op.out,    R(kOhm(100)), op.inN],   // feedback
  [op.inP,    GND()],
]);
```

---

### 3-pin Op-Amp — `OpAmp3(partNumber?)`

Simplified op-amp without explicit power pins. Use for quick schematics.

```ts
const op = OpAmp3('TL072');
// Pins: inP, inN, out
```

---

## Logic Gates

All gates support an optional IC family string (default: `'74HC'`).

```ts
import { NOT, AND, OR, XOR, NAND, NOR } from 'wirelang';

const inv  = NOT();           // Inverter — 1 input
const and2 = AND();           // 2-input AND
const or2  = OR();            // 2-input OR
const xor2 = XOR();           // 2-input XOR
const nand = NAND('74LS');    // NAND with explicit family
const nor  = NOR();
```

**Pin names:**
- `NOT`: `A` (input), `Y` (output)
- `AND`, `OR`, `XOR`, `NAND`, `NOR`: `A`, `B` (inputs), `Y` (output)

---

### Logic Levels — `HIGH()` / `LOW()`

Constant logic-level sources (1-pin output).

```ts
import { HIGH, LOW } from 'wirelang';

Circuit('NOT Gate', { autoGround: false }, [
  [HIGH(), not1.A],
  [not1.Y, LED(RED), LOW()],
]);
```

---

### Clock — `CLK(frequency, dutyCycle?)`

```ts
import { CLK, kHz } from 'wirelang';

const clk = CLK(kHz(1));          // 1 kHz, 50% duty
const clk = CLK(kHz(1), 0.25);   // 1 kHz, 25% duty
```

Output pin: `out`

---

## `ComponentType` enum

```ts
import { ComponentType } from 'wirelang';

ComponentType.Resistor       // 'resistor'
ComponentType.Capacitor      // 'capacitor'
ComponentType.Inductor       // 'inductor'
ComponentType.Diode          // 'diode'
ComponentType.LED            // 'led'
ComponentType.VoltageSource  // 'voltage_source'
ComponentType.CurrentSource  // 'current_source'
ComponentType.Ground         // 'ground'
ComponentType.PowerRail      // 'power_rail'
ComponentType.BJT            // 'bjt'
ComponentType.MOSFET         // 'mosfet'
ComponentType.OpAmp          // 'opamp'
ComponentType.LogicGate      // 'logic_gate'
```
