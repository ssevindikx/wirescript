# CLI Reference

WireScript CLI — **üç exchange formatı**, tek bir omurga (DB):

```
.ws (WireScript DSL)  ◄───►  WireScriptDb  ◄───►  .net (SPICE Netlist)
                                   │
                          .json / .csv (DB depolama)
```

## Kurulum

```sh
npm install -g @ssevindikx/wirescript
# veya npx ile:
npx wirescript <command>
```

---

## `convert` — Evrensel Dönüştürücü

Tüm format dönüşümlerini tek komutla yap.

```sh
wirescript convert <input> --to <format> [options]
```

### `--to` değerleri

| Değer | Çıktı formatı |
|---|---|
| `ws` | WireScript DSL (`.ws`) |
| `netlist` | SPICE netlist (`.net`) |
| `db` | DB JSON (`.json`) |
| `db-csv` | DB CSV (`.csv`) |
| `ts` | TypeScript modülü |

### Seçenekler

| Flag | Açıklama |
|---|---|
| `--to <format>` | Hedef format (zorunlu) |
| `--from <format>` | Kaynak format zorla belirt (opsiyonel, genellikle otomatik algılanır) |
| `--out <file>` | Çıktıyı dosyaya yaz (varsayılan: stdout) |
| `--name <name>` | Şematik adını geçersiz kıl |
| `--title <title>` | SPICE netlist başlık yorumu |
| `--export <name>` | TypeScript modülü export adı |
| `--import <path>` | TypeScript modülü import yolu |

### Örnekler

```sh
# .ws → SPICE netlist
wirescript convert circuit.ws --to netlist --out circuit.net

# SPICE netlist → .ws
wirescript convert circuit.net --to ws --out circuit.ws

# .ws → DB JSON
wirescript convert circuit.ws --to db --out circuit.json

# .json → DB CSV
wirescript convert circuit.json --to db-csv --out circuit.db.csv

# .csv → .ws
wirescript convert circuit.db.csv --to ws

# .ts modülü → netlist (doğrudan, ara JSON olmadan)
wirescript convert my-circuit.ts --to netlist --out circuit.net

# Format zorla (içeriğe göre otomatik algılanamıyorsa)
wirescript convert circuit.txt --from netlist --to ws
```

---

## Kısa Form Komutlar

### `to-ws` — Herhangi bir format → `.ws`

```sh
wirescript to-ws <input> [--out file.ws] [--name "..."]
```

```sh
wirescript to-ws circuit.json
wirescript to-ws circuit.net --out circuit.ws
wirescript to-ws circuit.db.csv
```

### `from-ws` — `.ws` → DB JSON

```sh
wirescript from-ws <input.ws> [--out file.json]
```

```sh
wirescript from-ws circuit.ws
wirescript from-ws circuit.ws --out circuit.json
```

### `to-netlist` — Herhangi bir format → SPICE netlist

```sh
wirescript to-netlist <input> [--out file.net] [--title "..."]
```

```sh
wirescript to-netlist circuit.json --out circuit.net
wirescript to-netlist circuit.ws --title "LED Driver v2"
wirescript to-netlist circuit.db.csv
```

### `from-netlist` — SPICE netlist → DB JSON

```sh
wirescript from-netlist <input.net> [--out file.json] [--name "..."]
```

```sh
wirescript from-netlist circuit.net
wirescript from-netlist circuit.net --out circuit.json --name "My Circuit"
```

### `to-db` — Herhangi bir format → DB (JSON veya CSV)

```sh
wirescript to-db <input> [--format json|csv] [--out file]
```

```sh
wirescript to-db circuit.ws --format csv --out circuit.db.csv
wirescript to-db circuit.net --format json
```

### `compile` — `.ts`/`.ws` → DB JSON *(legacy/tanıdık isim)*

```sh
wirescript compile <input.ts|input.ws> [--out file.json]
```

```sh
wirescript compile my-circuit.ts --out circuit.json
wirescript compile circuit.ws --out circuit.json
```

`.ts` giriş dosyası default olarak bir `Schematic` export etmeli:

```ts
// my-circuit.ts
import { Circuit, DC, R, LED, GND, RED } from '@ssevindikx/wirescript';
export default Circuit('LED Driver', DC(5), R(330), LED(RED), GND());
```

### `decompile` — DB JSON/CSV → `.ws` veya `.ts` *(legacy/tanıdık isim)*

```sh
wirescript decompile <input.json> [--format ws|ts] [--out file]
```

```sh
wirescript decompile circuit.json
wirescript decompile circuit.json --format ts --out circuit.ts
wirescript decompile circuit.json --format ws --out circuit.ws
```

---

## Pipeline Örnekleri

CLI tüm komutlar stdin/stdout üzerinden birleştirilebilir:

```sh
# .ws → netlist (tek satır)
wirescript convert circuit.ws --to netlist --out circuit.net

# .ts → .ws (compile + decompile)
wirescript compile my-circuit.ts | wirescript decompile /dev/stdin --format ws

# netlist → .ws (net → DB → ws)
wirescript from-netlist circuit.net | wirescript to-ws /dev/stdin --out circuit.ws

# Tam döngü: .ws → netlist → DB → .ws
wirescript convert circuit.ws --to netlist \
  | wirescript convert /dev/stdin --from netlist --to ws

# .ts → DB CSV
wirescript compile my-circuit.ts \
  | wirescript to-db /dev/stdin --format csv --out circuit.db.csv
```

---

## Tüm Komutlar — Özet Tablosu

| Komut | Alias | Giriş | Çıkış |
|---|---|---|---|
| `convert --to ws` | `to-ws` | herhangi | `.ws` |
| `convert --to netlist` | `to-netlist` | herhangi | `.net` |
| `convert --to db` | `to-db` | herhangi | `.json` |
| `convert --to db-csv` | — | herhangi | `.csv` |
| `convert --to ts` | — | herhangi | `.ts` |
| `compile` | `dsl2db` | `.ts`/`.ws` | `.json` |
| `decompile` | `db2dsl` | `.json`/`.csv` | `.ws`/`.ts` |
| `from-ws` | — | `.ws` | `.json` |
| `from-netlist` | `import-netlist` | `.net` | `.json` |

---

## Programmatic Kullanım

Tüm CLI fonksiyonları library olarak da kullanılabilir:

```ts
import {
  // DB omurgası
  compileDslToDb, serializeDb, deserializeDb,

  // WireScript DSL (.ws)
  exportWs, importWs,

  // SPICE Netlist
  exportNetlist, importNetlist,

  // DB → DSL kod
  reverseDbToDsl,
} from '@ssevindikx/wirescript';

// Örnek: .ws → SPICE (API üzerinden)
const db = importWs(wsSource);         // ws → DB
const spice = exportNetlist(db);        // DB → netlist

// Örnek: DB kaydet/yükle
const csv = serializeDb(db, { format: 'csv' });    // DB → CSV
const db2 = deserializeDb(csv);                     // CSV → DB (otomatik algılar)
```

Tüm dönüşüm detayları için [IO & Formats](./io.md) ve [Serialization](./serialization.md).
