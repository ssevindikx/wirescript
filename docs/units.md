# Units Reference

WireScript provides SI prefix helper functions for all common electrical quantities.  
Each helper is a **pure multiplier** — it returns a plain `number` in the base SI unit.

```ts
import { kOhm, uF, mH, kHz } from 'wirescript';

R(kOhm(4.7))   // same as R(4700)
C(uF(100))     // same as C(0.0001)
L(mH(10))      // same as L(0.01)
CLK(kHz(1))    // same as CLK(1000)
```

---

## SI Prefix Constants

```ts
import { PICO, NANO, MICRO, MILLI, KILO, MEGA, GIGA } from 'wirescript';

PICO  // 1e-12
NANO  // 1e-9
MICRO // 1e-6
MILLI // 1e-3
KILO  // 1e3
MEGA  // 1e6
GIGA  // 1e9
```

---

## Resistance (Ω)

```ts
import { ohm, kOhm, MOhm } from 'wirescript';

ohm(330)      // 330 Ω
kOhm(4.7)     // 4700 Ω
MOhm(1)       // 1 000 000 Ω
```

---

## Capacitance (F)

```ts
import { F, mF, uF, nF, pF } from 'wirescript';

F(1)          // 1 F
mF(100)       // 0.1 F
uF(100)       // 100 µF = 0.0001 F
nF(10)        // 10 nF
pF(22)        // 22 pF
```

---

## Inductance (H)

```ts
import { H, mH, uH, nH } from 'wirescript';

H(1)          // 1 H
mH(10)        // 10 mH = 0.01 H
uH(470)       // 470 µH
nH(100)       // 100 nH
```

---

## Voltage (V)

```ts
import { V, mV, uV, kV } from 'wirescript';

V(5)          // 5 V
mV(100)       // 0.1 V
uV(50)        // 50 µV
kV(1)         // 1000 V
```

---

## Current (A)

```ts
import { A, mA, uA, nA } from 'wirescript';

A(1)          // 1 A
mA(20)        // 20 mA = 0.02 A
uA(100)       // 100 µA
nA(500)       // 500 nA
```

---

## Frequency (Hz)

```ts
import { Hz, kHz, MHz, GHz } from 'wirescript';

Hz(50)        // 50 Hz
kHz(10)       // 10 000 Hz
MHz(433)      // 433 000 000 Hz
GHz(2.4)      // 2.4 GHz
```

---

## Power (W)

```ts
import { W, mW, uW, kW } from 'wirescript';

W(5)          // 5 W
mW(100)       // 0.1 W
uW(500)       // 500 µW
kW(1)         // 1000 W
```

---

## `formatWithUnit(value, baseUnit)` — Pretty print

```ts
import { formatWithUnit } from 'wirescript';

formatWithUnit(4700, 'Ω')     // '4.7kΩ'
formatWithUnit(0.0001, 'F')   // '100µF'
formatWithUnit(1000, 'Hz')    // '1kHz'
formatWithUnit(0.02, 'A')     // '20mA'
```

---

## `parseWithUnit(valueStr)` — Parse string to value

```ts
import { parseWithUnit } from 'wirescript';

parseWithUnit('4.7kΩ')   // { value: 4700, unit: 'Ω' }
parseWithUnit('100µF')   // { value: 0.0001, unit: 'F' }
parseWithUnit('1kHz')    // { value: 1000, unit: 'Hz' }
```

Accepts both `u` and `µ` for micro prefix.
