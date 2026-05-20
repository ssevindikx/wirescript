# Electrical Rule Check (ERC)

ERC validates circuits against **physics-based electrical rules** without requiring simulation.  
It catches wiring mistakes, dangerous configurations, and design quality issues before they become hardware problems.

---

## Quick Start

```ts
import { Circuit, DC, R, LED, GND, RED, runERC } from '@ssevindikx/wirescript';

const circuit = Circuit('LED Driver', DC(5), R(330), LED(RED), GND());

const result = runERC(circuit);

console.log(result.passed);    // true
console.log(result.summary()); // ✅ ERC passed — no violations found.
```

```ts
// Inline on any schematic (after importing runERC or @ssevindikx/wirescript/erc)
const result = circuit.erc();
```

---

## `runERC(schematic, options?)` — Main function

```ts
import { runERC } from '@ssevindikx/wirescript';

const result = runERC(schematic);
const result = runERC(schematic, {
  rules: { floatingInput: false },
  fanOutLimit: 4,
});
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `rules` | `ERCRuleSet` | all `true` | Enable/disable individual rules |
| `fanOutLimit` | `number` | `10` | Max logic gate inputs per output (74HC standard) |

---

## `ERCResult` — Return value

```ts
result.passed          // boolean — true if no errors
result.violations      // ERCViolation[] — all violations
result.errors          // ERCViolation[] — severity: 'error'
result.warnings        // ERCViolation[] — severity: 'warning'
result.infos           // ERCViolation[] — severity: 'info'
result.summary()       // Formatted string with emoji icons
```

---

## `ERCViolation` — Individual violation

```ts
interface ERCViolation {
  ruleId:     string;       // 'ERC_SHORT_CIRCUIT'
  ruleName:   string;       // 'Short Circuit'
  severity:   'error' | 'warning' | 'info';
  message:    string;       // Detailed diagnostic message
  components: Component[];  // Affected components
  nodes:      Node[];       // Affected nodes
  pins:       Pin[];        // Affected pins
}
```

---

## ERC Rules

### 🔴 `ERC_NO_GROUND` — No ground reference

**Condition:** No `GND()` component and no ground-flagged node in the circuit.  
**Physics:** Without a reference potential, all node voltages are undefined.

```ts
// ❌ Triggers
Circuit('Bad', { autoGround: false }, [DC(5), R(1000)]);

// ✅ OK
Circuit('Good', DC(5), R(1000), GND());
```

---

### 🔴 `ERC_SHORT_CIRCUIT` — Direct short circuit

**Condition:** A voltage source's positive and negative terminals are connected via a zero-impedance path (no resistor, capacitor, inductor, diode, or transistor between them).  
**Physics:** V = IR → I = ∞ for R = 0. Will destroy the source and potentially start a fire.

```ts
// ❌ Triggers — V+ directly wired to GND
Circuit('Shorted', DC(5), GND());

// ✅ OK — resistor limits current
Circuit('Safe', DC(5), R(330), LED(RED), GND());
```

> **Detection method:** BFS graph traversal through zero-impedance paths. Only `PowerRail` components are treated as zero-impedance; all passive and active components block traversal.

---

### 🔴 `ERC_OUTPUT_CONFLICT` — Bus contention

**Condition:** Two or more output-direction pins connected to the same node.  
**Physics:** On CMOS, two outputs driving opposite levels creates a direct short between VCC and GND inside the IC. May permanently damage both devices.

```ts
// ❌ Triggers — two NOT outputs tied together
const n1 = NOT(), n2 = NOT();
Circuit('Conflict', { autoGround: false }, [
  [HIGH(), n1.A],
  [HIGH(), n2.A],
  [n1.Y, n2.Y],   // ← contention
]);
```

---

### 🔴 `ERC_MISSING_POWER_PIN` — OpAmp unpowered

**Condition:** A 5-pin op-amp has `vPos` or `vNeg` unconnected.  
**Physics:** Op-amps require a supply voltage to function. Output will be undefined (typically 0 V or floating).

```ts
// ❌ Triggers — vPos and vNeg not connected
const op = OpAmp('LM741');
Circuit('Broken', { autoGround: false }, [[op.inP, GND()]]);

// ✅ OK
Circuit('Powered', [
  [VCC(15),   op.vPos],
  [VNEG(-15), op.vNeg],
  [op.inP,    GND()],
]);
```

> **Note:** `OpAmp3` (3-pin) does not have power pins — this rule does not apply.

---

### 🔴 `ERC_REVERSE_POLARITY` — Diode/LED reverse biased

**Condition:** Estimated anode voltage < estimated cathode voltage.  
**Physics:** Forward current cannot flow through a reverse-biased diode. LED will not light. High reverse voltage may cause avalanche breakdown.

```ts
// ❌ Triggers — anode at GND (0V), cathode at VCC (5V)
// anode→0V, cathode→5V → reversed

// ✅ OK — anode at higher potential than cathode
Circuit('Correct', DC(5), R(330), LED(RED), GND());
```

> **Note:** Voltage estimation is based on directly connected power sources. Nodes with unknown potential are skipped.

---

### 🔴 `ERC_POWER_CONFLICT` — Conflicting supply voltages

**Condition:** Two power sources with different voltage values are connected to the same node.  
**Physics:** Both supplies try to force the node to their respective voltage. Whichever has lower impedance "wins" — the other is effectively short-circuited.

```ts
// ❌ Triggers — 5V and 3.3V on same net
Circuit('Fight', { autoGround: false }, [[VCC(5), VCC(3.3)]]);

// ✅ OK — same voltage, same rail
Circuit('Fine', { autoGround: false }, [
  [VCC(5), R(kOhm(1))],
  [VCC(5), R(kOhm(2))],
]);
```

---

### 🔴 `ERC_NO_CURRENT_LIMIT` — LED without resistor

**Condition:** LED or diode anode is directly connected to a positive supply rail and cathode is connected to ground, with no resistor on either side.  
**Physics:** Without a series resistor, forward current is limited only by the source impedance (≈ 0 for ideal sources). Typical LED max current is 20 mA; exceeding this destroys the LED instantly.

```ts
// ❌ Triggers
const led = LED(RED);
Circuit('Bare LED', { autoGround: false }, [
  [VCC(5), led.anode],
  [led.cathode, GND()],
]);

// ✅ OK — 330 Ω limits current to (5 - 1.8) / 330 ≈ 9.7 mA
Circuit('Safe LED', DC(5), R(330), LED(RED), GND());
```

---

### 🟡 `ERC_FLOATING_INPUT` — Input pin with no driver

**Condition:** An input-direction pin is connected to a node that has no output-capable driver (no output pin, no power source).  
**Physics:** Floating inputs on CMOS can oscillate randomly due to stray capacitance and noise, causing excessive current draw and undefined behavior.

```ts
// ❌ Warning — and1.B has no driver
const and1 = AND();
Circuit('Floating', { autoGround: false }, [
  [HIGH(), and1.A],   // A is driven
  // B is unconnected — floating input
  [and1.Y, R(kOhm(1))],
]);
```

---

### 🟡 `ERC_FAN_OUT` — Fan-out exceeded

**Condition:** A logic gate output drives more inputs than `fanOutLimit` (default: 10).  
**Physics:** Each gate input draws a small input current. With 74HC gates, the output can reliably source/sink current for ~10 standard loads. Exceeding this raises VOL above VIL, causing logic errors.

```ts
const result = runERC(circuit, { fanOutLimit: 10 });
// Warning if any gate drives > 10 inputs
```

---

### 🟡 `ERC_VOLTAGE_EXCEEDED` — Rating exceeded

**Condition:** Estimated supply voltage at LED anode exceeds the typical max forward voltage (3.5 V) and no current-limiting resistor is present on that node.  
**Physics:** Applying excess voltage directly to an LED will drive current beyond the rated maximum, causing thermal destruction.

```ts
// ❌ Warning — 12V directly at LED anode
const led = LED(GREEN);
Circuit('HighV', { autoGround: false }, [
  [VCC(12), led.anode],
  [led.cathode, GND()],
]);

// ✅ OK — resistor drops the excess voltage
Circuit('Protected', { autoGround: false }, [
  [VCC(12), R(560), led.anode],
  [led.cathode, GND()],
]);
```

---

### 🟡 `ERC_TRANSISTOR_NO_DRIVE` — Control pin floating

**Condition:** BJT Base pin (`B`) or MOSFET Gate pin (`G`) is not connected.  
**Physics:** Without a control signal, the transistor is in an undefined state — it may conduct, not conduct, or oscillate unpredictably.

```ts
const t = NPN('2N2222');

// ❌ Warning — Base is floating
Circuit('NoDrive', { autoGround: false }, [
  [VCC(5), R(kOhm(1)), t.C],
  [t.E, GND()],
  // t.B not connected
]);

// ✅ OK
Circuit('Driven', [
  [DC(5), R(kOhm(1)), LED(RED), t.C],
  [t.E, GND()],
  [DC(5), R(kOhm(10)), t.B],   // base drive
]);
```

---

### 🔵 `ERC_DRIVER_CONFLICT` — Analog/digital interface

**Condition:** An analog output (op-amp, voltage source) directly drives a digital logic input on the same node.  
**Info:** May work in many cases, but requires verification that voltage levels are within the digital input thresholds (VIL, VIH).

---

## Selective Rules

All rules are `true` by default. Disable selectively:

```ts
const result = runERC(circuit, {
  rules: {
    noGround:         true,
    shortCircuit:     true,
    outputConflict:   true,
    missingPowerPin:  true,
    reversePolarity:  true,
    powerConflict:    true,
    noCurrentLimit:   true,
    floatingInput:    false,  // ← disabled
    fanOut:           true,
    voltageExceeded:  true,
    transistorNoDrive: true,
    driverConflict:   false,  // ← disabled
  },
  fanOutLimit: 8,
});
```

---

## Severity Levels

| Severity | Meaning |
|---|---|
| `'error'` | Circuit will not function correctly or is physically dangerous |
| `'warning'` | Circuit may malfunction under some conditions |
| `'info'` | Design quality observation — worth reviewing |

`result.passed` is `true` only when there are **zero errors**. Warnings and infos are allowed.
