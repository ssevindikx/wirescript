# WireScript DSL Format (`.ws`)

`.ws` dosyaları WireScript'in doğal, insan-okunabilir devre tanımlama formatıdır.  
Saf `Circuit()` DSL sözdizimi kullanır — `import`/`export` yoktur.

---

## Dosya Yapısı

```
// Opsiyonel başlık yorumları

<bileşen_adı> = <fabrika_fonksiyonu>
...

Circuit(
  "<devre_adı>",
  [
    [<pin1>, <pin2>, ...],   // Aynı düğüme bağlı pinler
    ...
  ]
)
```

### Örnek: LED Sürücüsü

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

### Örnek: NPN Transistör Anahtarı

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

## Kurallar

| Kural | Açıklama |
|---|---|
| ✅ `Circuit(...)` zorunlu | Her `.ws` dosyası en az bir `Circuit()` çağrısı içermeli |
| ✅ Tüm bileşen fabrikaları kullanılabilir | `R()`, `C()`, `DC()`, `NPN()`, `OpAmp()` vb. |
| ✅ Yorum satırları `//` | Standart JS yorum sözdizimi |
| ❌ `import` yasak | `.ws` dosyaları modül sözdizimi içeremez |
| ❌ `export` yasak | Çıktı doğrudan `Circuit()` çağrısından alınır |
| ❌ `require()` yasak | Sadece saf DSL sözdizimi |

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
# herhangi bir formattan .ws üret
wirescript convert circuit.json --to ws --out circuit.ws
wirescript convert circuit.net --to ws --out circuit.ws

# kısa form
wirescript to-ws circuit.json --out circuit.ws
wirescript to-ws circuit.net

# .ws → DB JSON
wirescript from-ws circuit.ws --out circuit.json

# .ws → SPICE netlist (ws → DB → netlist)
wirescript convert circuit.ws --to netlist --out circuit.net
```

---

## Round-trip

`.ws` formatı tam round-trip destekler:

```ts
import { Circuit, DC, R, GND, compileDslToDb, exportWs, importWs } from '@ssevindikx/wirescript';

// Orijinal devre
const circuit = Circuit('Test', DC(5), R(1000), GND());
const original = compileDslToDb(circuit);

// DB → .ws → DB
const wsCode = exportWs(original);
const rebuilt = importWs(wsCode);

console.log(rebuilt.components.length === original.components.length); // true
console.log(rebuilt.name === original.name);                           // true
```

---

Daha fazla bilgi için [IO Kılavuzu](./io.md) ve [CLI Referansı](./cli.md).
