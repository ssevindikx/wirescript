# TypeScript API Reference

The TypeScript API gives you **full, explicit control** over every node and pin.  
Use it when topologies are too complex for the declarative DSL (e.g. bridge rectifiers, multi-feedback networks).

---

## `createSchematic(name?)` — Create a schematic

```ts
createSchematic(name?: string): Schematic
```

```ts
import { createSchematic } from 'wirescript';

const s = createSchematic('My Circuit');
```

---

## `Schematic` — The circuit container

### Properties

| Property | Type | Description |
|---|---|---|
| `name` | `string` | Circuit name |
| `components` | `readonly Component[]` | All components |
| `nodes` | `readonly Node[]` | All nodes (nets) |
| `groundNode` | `Node` | Lazily created shared ground node |

### Component management

```ts
s.addComponent(component)              // Add one component
s.addComponents(r, c, led, gnd)        // Add many at once
```

### Node management

```ts
const n = s.createNode()              // Create and register a new node
const n = s.createNode('VCC')         // Named node (shows in summary)
s.addNode(existingNode)               // Register an externally created node
```

### Pin connection

```ts
s.connect(pin, node)                  // Connect a pin to a node
s.connectAll([pin1, pin2], node)      // Connect many pins to one node
```

### Querying

```ts
s.getComponentById('resistor_1')      // Find component by ID
s.getComponentsByType('resistor')     // Find all resistors
s.getPinsAtNode(node)                 // All pins on a given node
s.getUnconnectedPins()                // All unconnected pins
```

### Validation

```ts
const result = s.validate();
// { valid: boolean, errors: string[], warnings: string[] }
```

### ERC

```ts
// Requires 'wirescript/erc' to have been imported at least once
const result = s.erc();
const result = s.erc({ fanOutLimit: 4, rules: { floatingInput: false } });
```

### Ground utilities

```ts
s.mergeGrounds()                      // Merge multiple GND components into one node
s.autoConnectGrounds()                // Connect unconnected source negatives to GND
```

### Output

```ts
s.getSummary()                        // Multi-line human-readable text
s.toString()                          // Short one-liner
```

---

## `Component` — Base class

All components extend `Component`. Key members:

| Member | Type | Description |
|---|---|---|
| `id` | `string` | Auto-generated unique ID (`resistor_1`) |
| `type` | `ComponentType` | Enum value (`'resistor'`, `'led'`, …) |
| `label` | `string` | Human-readable label (`R1`, `LED3`, `Q1`) |
| `params` | `ComponentParams` | `{ value: number, unit: string, ...extras }` |
| `pins` | `Pin[]` | All pins |
| `p1` | `Pin` | First pin (positive / input) |
| `p2` | `Pin` | Second pin (negative / output) |

```ts
component.getPin('anode')             // Pin by name (undefined if not found)
component.pin('cathode')              // Pin by name (throws if not found)
component.validate()                  // string[] of errors
component.toString()                  // 'Resistor(330Ω)'
```

---

## `Pin` — Connection point

| Member | Type | Description |
|---|---|---|
| `id` | `string` | Unique auto-generated ID |
| `name` | `string` | Pin name (`'anode'`, `'B'`, `'1'`, …) |
| `direction` | `PinDirection?` | `Input`, `Output`, or `Bidirectional` |
| `node` | `Node \| null` | Connected node |
| `component` | `ComponentRef \| null` | Owner component reference |
| `fullName` | `string` | `'R1.1'`, `'Q1.C'`, `'LED1.anode'` |

```ts
pin.isConnected()                     // boolean
pin.isConnectedTo(node)               // boolean
pin.connectTo(node)                   // Wire this pin to a node
pin.disconnect()                      // Remove connection
```

---

## `Node` — Electrical net

```ts
import { Node, createGroundNode } from 'wirescript';

const n = new Node()                  // Anonymous node
const n = new Node('VCC')            // Named node
const gnd = createGroundNode()        // Ground-flagged node

node.id                               // 'node_1'
node.name                             // optional label
node.isGround()                       // boolean
node.toString()                       // 'Node(VCC)' or 'GND'
```

---

## Identity helpers

Preserve stable IDs across serialization round-trips:

```ts
import { applyComponentIdentity, applyNodeIdentity, applyPinIdentity } from 'wirescript';

applyComponentIdentity(component, {
  id: 'resistor_1',
  label: 'R1',
  pinIds: { '1': 'pin_1', '2': 'pin_2' },
});

applyNodeIdentity(node, 'node_5');
applyPinIdentity(pin, 'pin_9');
```

---

## Full example — Bridge Rectifier (TypeScript API)

```ts
import { createSchematic, AC, D, R, C, GND } from 'wirescript';

const s = createSchematic('Full-Wave Rectifier');

const src = AC(12, 60);
const d1 = D('1N4007'), d2 = D('1N4007');
const d3 = D('1N4007'), d4 = D('1N4007');
const load = R(1000);
const cap  = C(100e-6);
const gnd  = GND();

s.addComponents(src, d1, d2, d3, d4, load, cap, gnd);

const acP  = s.createNode('AC+');
const acN  = s.createNode('AC-');
const dcP  = s.createNode('DC+');
const dcN  = s.createNode('DC-');

s.connect(src.positive,  acP);
s.connect(src.negative,  acN);

s.connect(d1.anode,   acP);   s.connect(d1.cathode, dcP);
s.connect(d2.anode,   dcN);   s.connect(d2.cathode, acP);
s.connect(d3.anode,   acN);   s.connect(d3.cathode, dcP);
s.connect(d4.anode,   dcN);   s.connect(d4.cathode, acN);

s.connect(load.p1, dcP);  s.connect(load.p2, dcN);
s.connect(cap.p1,  dcP);  s.connect(cap.p2,  dcN);
s.connect(gnd.gnd, dcN);

console.log(s.getSummary());
```
