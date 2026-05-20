/**
 * WireScript ERC — Electrical Rule Check
 *
 * Statically validates circuit topology and electrical constraints
 * without requiring full SPICE simulation.
 *
 * Severity levels:
 *   ERROR   — circuit will not function / physically dangerous
 *   WARNING — may malfunction under certain conditions
 *   INFO    — design quality observation
 *
 * Usage:
 *   import { runERC } from 'wirescript';
 *   const result = runERC(schematic);
 *   console.log(result.summary());
 */

import { Component } from './Component';
import { Node } from './Node';
import { Pin } from './Pin';
import { Schematic } from './Schematic';
import { ComponentType, PinDirection } from './types';

// ─────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────

export type ERCSeverity = 'error' | 'warning' | 'info';

export interface ERCViolation {
  /** Unique rule identifier e.g. "ERC_SHORT_CIRCUIT" */
  ruleId: string;
  /** Human-readable rule name */
  ruleName: string;
  /** Severity */
  severity: ERCSeverity;
  /** Detailed diagnostic message */
  message: string;
  /** Affected components */
  components: Component[];
  /** Affected nodes */
  nodes: Node[];
  /** Affected pins */
  pins: Pin[];
}

export class ERCResult {
  readonly violations: ERCViolation[];

  constructor(violations: ERCViolation[]) {
    this.violations = violations;
  }

  get passed(): boolean {
    return this.errors.length === 0;
  }

  get errors(): ERCViolation[] {
    return this.violations.filter(v => v.severity === 'error');
  }

  get warnings(): ERCViolation[] {
    return this.violations.filter(v => v.severity === 'warning');
  }

  get infos(): ERCViolation[] {
    return this.violations.filter(v => v.severity === 'info');
  }

  summary(): string {
    if (this.violations.length === 0) {
      return '✅ ERC passed — no violations found.';
    }
    const lines: string[] = [
      `ERC Result: ${this.errors.length} error(s), ${this.warnings.length} warning(s), ${this.infos.length} info(s)`,
      '',
    ];
    for (const v of this.violations) {
      const icon = v.severity === 'error' ? '🔴' : v.severity === 'warning' ? '🟡' : '🔵';
      lines.push(`${icon} [${v.ruleId}] ${v.message}`);
    }
    return lines.join('\n');
  }
}

export interface ERCRuleSet {
  /** V+/V- of same source on same node */
  shortCircuit?: boolean;
  /** Two output-capable pins driving same node */
  outputConflict?: boolean;
  /** Input pin with no driver on its net */
  floatingInput?: boolean;
  /** OpAmp power pins (vPos/vNeg) unconnected */
  missingPowerPin?: boolean;
  /** Diode/LED connected with reversed polarity */
  reversePolarity?: boolean;
  /** Two power sources at different voltages on same node */
  powerConflict?: boolean;
  /** Logic gate output drives more inputs than fanOutLimit */
  fanOut?: boolean;
  /** No ground reference in circuit */
  noGround?: boolean;
  /** LED directly across supply with no current-limiting element */
  noCurrentLimit?: boolean;
  /** Component voltage rating exceeded by estimated supply */
  voltageExceeded?: boolean;
  /** Analog output driving digital input or vice-versa */
  driverConflict?: boolean;
  /** Transistor with no base/gate drive (unconnected control pin) */
  transistorNoDrive?: boolean;
}

export interface ERCOptions {
  rules?: ERCRuleSet;
  /** Fan-out limit for logic gates (default: 10 for 74HC) */
  fanOutLimit?: number;
}

// ─────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────

/** Maps nodeId → all pins connected to that node */
function buildNodePinMap(schematic: Schematic): Map<string, Pin[]> {
  const map = new Map<string, Pin[]>();
  for (const comp of schematic.components) {
    for (const pin of comp.pins) {
      if (pin.isConnected() && pin.node) {
        const id = pin.node.id;
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(pin);
      }
    }
  }
  return map;
}

/** Component types that limit current (have impedance) */
const IMPEDANCE_TYPES = new Set<string>([
  ComponentType.Resistor,
  ComponentType.Capacitor,
  ComponentType.Inductor,
  ComponentType.Diode,
  ComponentType.LED,
  ComponentType.BJT,
  ComponentType.NPN,
  ComponentType.PNP,
  ComponentType.MOSFET,
  ComponentType.NMOS,
  ComponentType.PMOS,
  ComponentType.NJFET,
  ComponentType.PJFET,
  ComponentType.OpAmp,
]);

/** Component types that are power sources (define a voltage) */
const POWER_SOURCE_TYPES = new Set<string>([
  ComponentType.VoltageSource,
  ComponentType.PowerRail,
  ComponentType.Ground,
]);

/** Component types that are analog outputs */
const ANALOG_OUTPUT_TYPES = new Set<string>([
  ComponentType.VoltageSource,
  ComponentType.CurrentSource,
  ComponentType.OpAmp,
  ComponentType.PowerRail,
]);

/** Component types that are digital (logic) */
const DIGITAL_TYPES = new Set<string>([
  ComponentType.LogicGate,
]);

/**
 * Estimate the voltage at a node based on directly connected power sources.
 * Returns undefined if unknown (requires simulation).
 */
function estimateNodeVoltage(
  node: Node,
  nodePinMap: Map<string, Pin[]>,
): number | undefined {
  if (node.isGround()) return 0;
  const pins = nodePinMap.get(node.id) ?? [];
  for (const pin of pins) {
    const comp = pin.component as Component | null;
    if (!comp) continue;
    if (comp.type === ComponentType.Ground) return 0;
    if (comp.type === ComponentType.PowerRail) return comp.params.value;
    if (comp.type === ComponentType.VoltageSource && pin.name === 'positive') {
      return comp.params.value;
    }
    if (comp.type === ComponentType.VoltageSource && pin.name === 'negative') {
      return 0;
    }
  }
  return undefined;
}

/**
 * BFS: can we reach `endNode` from `startNode` going ONLY through
 * zero-impedance components (power rails, wires — NOT through passives/active)?
 * Returns true if a zero-impedance path exists → potential short circuit.
 *
 * Note: Ground components are NOT traversed here — a Ground IS an endpoint
 * (the V- of the source should already be on the GND node via autoGround).
 * We only traverse through PowerRail type components, which act as ideal
 * voltage rails with no impedance between instances of the same rail.
 */
function hasZeroImpedancePath(
  startNode: Node,
  endNode: Node,
  nodePinMap: Map<string, Pin[]>,
): boolean {
  if (startNode.id === endNode.id) return true;

  // Only traverse through PowerRail components (ideal, zero-impedance supplies)
  // Everything else (R, C, L, Diode, LED, BJT, MOSFET, OpAmp, Ground) blocks traversal
  const ZERO_IMPEDANCE = new Set<string>([ComponentType.PowerRail]);

  const visited = new Set<string>();
  const queue: Node[] = [startNode];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.id === endNode.id) return true;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    const pins = nodePinMap.get(current.id) ?? [];
    for (const pin of pins) {
      const comp = pin.component as Component | null;
      if (!comp) continue;
      if (!ZERO_IMPEDANCE.has(comp.type)) continue;
      for (const otherPin of (comp as Component).pins) {
        if (otherPin === pin) continue;
        if (otherPin.node && !visited.has(otherPin.node.id)) {
          queue.push(otherPin.node);
        }
      }
    }
  }
  return false;
}

/** Helper to build a violation object */
function violation(
  ruleId: string,
  ruleName: string,
  severity: ERCSeverity,
  message: string,
  components: Component[] = [],
  nodes: Node[] = [],
  pins: Pin[] = [],
): ERCViolation {
  return { ruleId, ruleName, severity, message, components, nodes, pins };
}

// ─────────────────────────────────────────────────────────────
// ERC Rules
// ─────────────────────────────────────────────────────────────

/**
 * RULE: SHORT_CIRCUIT
 * Detects when the positive and negative terminals of a voltage source
 * are connected via a zero-impedance path (no current-limiting element).
 */
function checkShortCircuit(
  schematic: Schematic,
  nodePinMap: Map<string, Pin[]>,
): ERCViolation[] {
  const results: ERCViolation[] = [];
  const sources = schematic.components.filter(
    c => c.type === ComponentType.VoltageSource,
  );

  for (const source of sources) {
    const posPin = source.pins.find(p => p.name === 'positive');
    const negPin = source.pins.find(p => p.name === 'negative');
    if (!posPin?.node || !negPin?.node) continue;

    const posNode = posPin.node;
    const negNode = negPin.node;

    if (hasZeroImpedancePath(posNode, negNode, nodePinMap)) {
      results.push(violation(
        'ERC_SHORT_CIRCUIT',
        'Short Circuit',
        'error',
        `${source.label}: positive and negative terminals are short-circuited (zero-impedance path detected). This will cause infinite current.`,
        [source],
        [posNode, negNode],
        [posPin, negPin],
      ));
    }
  }
  return results;
}

/**
 * RULE: OUTPUT_CONFLICT
 * Two or more output-direction pins driving the same node.
 * (Wired-OR on CMOS outputs can destroy ICs.)
 */
function checkOutputConflict(
  schematic: Schematic,
  nodePinMap: Map<string, Pin[]>,
): ERCViolation[] {
  const results: ERCViolation[] = [];
  for (const node of schematic.nodes) {
    const pins = nodePinMap.get(node.id) ?? [];
    const outputPins = pins.filter(p => p.direction === PinDirection.Output);
    if (outputPins.length >= 2) {
      const compLabels = outputPins
        .map(p => (p.component as Component | null)?.label ?? '?')
        .join(', ');
      results.push(violation(
        'ERC_OUTPUT_CONFLICT',
        'Output Driver Conflict',
        'error',
        `Node ${node.name ?? node.id}: multiple output drivers connected (${compLabels}). This causes bus contention and may damage components.`,
        outputPins.map(p => p.component as Component).filter(Boolean),
        [node],
        outputPins,
      ));
    }
  }
  return results;
}

/**
 * RULE: FLOATING_INPUT
 * An input pin's node has NO output-capable driver.
 * A floating input has undefined logic state and is susceptible to noise.
 */
function checkFloatingInput(
  schematic: Schematic,
  nodePinMap: Map<string, Pin[]>,
): ERCViolation[] {
  const results: ERCViolation[] = [];
  for (const comp of schematic.components) {
    for (const pin of comp.pins) {
      if (pin.direction !== PinDirection.Input) continue;
      if (!pin.isConnected() || !pin.node) continue;
      const nodeId = pin.node.id;
      const nodePins = nodePinMap.get(nodeId) ?? [];
      const hasDriver = nodePins.some(
        p => p.direction === PinDirection.Output || POWER_SOURCE_TYPES.has(
          (p.component as Component | null)?.type ?? '',
        ),
      );
      if (!hasDriver) {
        results.push(violation(
          'ERC_FLOATING_INPUT',
          'Floating Input',
          'warning',
          `${pin.fullName}: input pin has no driver on net "${pin.node.name ?? nodeId}". Undefined voltage level — susceptible to noise pickup.`,
          [comp],
          [pin.node],
          [pin],
        ));
      }
    }
  }
  return results;
}

/**
 * RULE: MISSING_POWER_PIN
 * OpAmp supply pins (vPos / vNeg) are not connected.
 * An unpowered OpAmp will not function.
 */
function checkMissingPowerPin(schematic: Schematic): ERCViolation[] {
  const results: ERCViolation[] = [];
  const opAmps = schematic.components.filter(
    c => c.type === ComponentType.OpAmp,
  );
  for (const op of opAmps) {
    const vPos = op.pins.find(p => p.name === 'vPos');
    const vNeg = op.pins.find(p => p.name === 'vNeg');
    if (vPos && !vPos.isConnected()) {
      results.push(violation(
        'ERC_MISSING_POWER_PIN',
        'Missing Power Pin',
        'error',
        `${op.label}: positive supply pin (vPos / V+) is not connected. OpAmp will not operate.`,
        [op], [], [vPos],
      ));
    }
    if (vNeg && !vNeg.isConnected()) {
      results.push(violation(
        'ERC_MISSING_POWER_PIN',
        'Missing Power Pin',
        'error',
        `${op.label}: negative supply pin (vNeg / V-) is not connected. OpAmp will not operate.`,
        [op], [], [vNeg],
      ));
    }
  }
  return results;
}

/**
 * RULE: REVERSE_POLARITY
 * Diode / LED connected with anode at a lower estimated voltage than cathode.
 * A reversed diode blocks forward current; a reversed LED will not light.
 */
function checkReversePolarity(
  schematic: Schematic,
  nodePinMap: Map<string, Pin[]>,
): ERCViolation[] {
  const results: ERCViolation[] = [];
  const polarized = schematic.components.filter(
    c => c.type === ComponentType.Diode || c.type === ComponentType.LED,
  );
  for (const comp of polarized) {
    const anode = comp.pins.find(p => p.name === 'anode');
    const cathode = comp.pins.find(p => p.name === 'cathode');
    if (!anode?.node || !cathode?.node) continue;

    const vAnode = estimateNodeVoltage(anode.node, nodePinMap);
    const vCathode = estimateNodeVoltage(cathode.node, nodePinMap);

    if (vAnode !== undefined && vCathode !== undefined && vAnode < vCathode) {
      results.push(violation(
        'ERC_REVERSE_POLARITY',
        'Reverse Polarity',
        'error',
        `${comp.label}: anode (~${vAnode}V) is at a lower potential than cathode (~${vCathode}V). Component is reverse-biased — forward current will not flow.`,
        [comp],
        [anode.node, cathode.node],
        [anode, cathode],
      ));
    }
  }
  return results;
}

/**
 * RULE: POWER_CONFLICT
 * Two power sources with different voltage levels are connected to the same node.
 * This creates a direct fight between supplies.
 */
function checkPowerConflict(
  schematic: Schematic,
  nodePinMap: Map<string, Pin[]>,
): ERCViolation[] {
  const results: ERCViolation[] = [];
  for (const node of schematic.nodes) {
    const pins = nodePinMap.get(node.id) ?? [];
    const powerPins = pins.filter(p => {
      const type = (p.component as Component | null)?.type ?? '';
      return (
        type === ComponentType.PowerRail ||
        (type === ComponentType.VoltageSource && p.name === 'positive')
      );
    });
    if (powerPins.length < 2) continue;
    const voltages = powerPins.map(p => (p.component as Component).params.value);
    const unique = [...new Set(voltages)];
    if (unique.length > 1) {
      const labels = powerPins
        .map(p => `${(p.component as Component).label}(${(p.component as Component).params.value}V)`)
        .join(', ');
      results.push(violation(
        'ERC_POWER_CONFLICT',
        'Power Supply Conflict',
        'error',
        `Node "${node.name ?? node.id}": multiple power sources with different voltages connected: ${labels}. Supplies will fight each other.`,
        powerPins.map(p => p.component as Component),
        [node],
        powerPins,
      ));
    }
  }
  return results;
}

/**
 * RULE: FAN_OUT
 * A single logic gate output drives more inputs than the family's rated fan-out.
 * Exceeding fan-out degrades signal integrity (VOL rises above VIL).
 */
function checkFanOut(
  schematic: Schematic,
  nodePinMap: Map<string, Pin[]>,
  limit: number,
): ERCViolation[] {
  const results: ERCViolation[] = [];
  for (const comp of schematic.components) {
    if (comp.type !== ComponentType.LogicGate) continue;
    const outPin = comp.pins.find(p => p.name === 'Y' || p.direction === PinDirection.Output);
    if (!outPin?.node) continue;
    const drivingNode = outPin.node;
    const inputsOnNode = (nodePinMap.get(drivingNode.id) ?? []).filter(
      p => p.direction === PinDirection.Input && p !== outPin,
    );
    if (inputsOnNode.length > limit) {
      results.push(violation(
        'ERC_FAN_OUT',
        'Fan-Out Exceeded',
        'warning',
        `${comp.label}: output drives ${inputsOnNode.length} inputs (limit: ${limit}). Signal integrity may be compromised. Add a buffer or reduce load.`,
        [comp],
        [drivingNode],
        [outPin],
      ));
    }
  }
  return results;
}

/**
 * RULE: NO_GROUND
 * Circuit has no ground reference node.
 * All voltages are relative — without GND, DC operating points are undefined.
 */
function checkNoGround(schematic: Schematic): ERCViolation[] {
  const hasGround =
    schematic.nodes.some(n => n.isGround()) ||
    schematic.components.some(c => c.type === ComponentType.Ground);
  if (!hasGround) {
    return [violation(
      'ERC_NO_GROUND',
      'No Ground Reference',
      'error',
      'Circuit has no ground (GND) reference. All node voltages are undefined. Add a GND() component.',
    )];
  }
  return [];
}

/**
 * RULE: NO_CURRENT_LIMIT
 * LED or Diode directly connected to a voltage source with no series resistor
 * (or other current-limiting element) between them.
 * Exceeding max forward current will instantly destroy the component.
 */
function checkNoCurrentLimit(
  schematic: Schematic,
  nodePinMap: Map<string, Pin[]>,
): ERCViolation[] {
  const results: ERCViolation[] = [];
  const leds = schematic.components.filter(
    c => c.type === ComponentType.LED || c.type === ComponentType.Diode,
  );

  for (const led of leds) {
    const anode = led.pins.find(p => p.name === 'anode');
    const cathode = led.pins.find(p => p.name === 'cathode');
    if (!anode?.node || !cathode?.node) continue;

    // Check anode side for direct power source with no resistor
    const anodePins = nodePinMap.get(anode.node.id) ?? [];
    const cathodePins = nodePinMap.get(cathode.node.id) ?? [];

    const anodeDirect = anodePins.some(p => {
      const type = (p.component as Component | null)?.type ?? '';
      return POWER_SOURCE_TYPES.has(type) && type !== ComponentType.Ground;
    });
    const cathodeGround = cathode.node.isGround() ||
      cathodePins.some(p => (p.component as Component | null)?.type === ComponentType.Ground);

    const hasResistorOnAnode = anodePins.some(
      p => (p.component as Component | null)?.type === ComponentType.Resistor,
    );
    const hasResistorOnCathode = cathodePins.some(
      p => (p.component as Component | null)?.type === ComponentType.Resistor,
    );

    if (anodeDirect && cathodeGround && !hasResistorOnAnode && !hasResistorOnCathode) {
      results.push(violation(
        'ERC_NO_CURRENT_LIMIT',
        'No Current Limiting Resistor',
        'error',
        `${led.label}: connected directly across a supply with no current-limiting resistor. Exceeds maximum forward current — component will be destroyed.`,
        [led],
        [anode.node, cathode.node],
        [anode, cathode],
      ));
    }
  }
  return results;
}

/**
 * RULE: VOLTAGE_EXCEEDED
 * Estimated supply voltage exceeds a component's maximum rated voltage.
 * (LED max forward voltage ~3.5V; standard logic 5V max; etc.)
 */
function checkVoltageExceeded(
  schematic: Schematic,
  nodePinMap: Map<string, Pin[]>,
): ERCViolation[] {
  const results: ERCViolation[] = [];

  // LED max forward voltage rating (typical)
  const LED_MAX_VF = 3.5;

  const leds = schematic.components.filter(c => c.type === ComponentType.LED);
  for (const led of leds) {
    const anode = led.pins.find(p => p.name === 'anode');
    if (!anode?.node) continue;
    const vAnode = estimateNodeVoltage(anode.node, nodePinMap);
    if (vAnode !== undefined && vAnode > LED_MAX_VF) {
      // Only warn if there's no current limiting resistor nearby
      const anodePins = nodePinMap.get(anode.node.id) ?? [];
      const hasResistor = anodePins.some(
        p => (p.component as Component | null)?.type === ComponentType.Resistor,
      );
      if (!hasResistor) {
        results.push(violation(
          'ERC_VOLTAGE_EXCEEDED',
          'Voltage Rating Exceeded',
          'warning',
          `${led.label}: supply voltage (~${vAnode}V) exceeds typical LED max forward voltage (${LED_MAX_VF}V). Add a current-limiting resistor.`,
          [led],
          [anode.node],
          [anode],
        ));
      }
    }
  }
  return results;
}

/**
 * RULE: DRIVER_CONFLICT
 * An analog output (OpAmp/VoltageSource) directly drives a digital logic input,
 * or a digital output drives an analog input, without interface circuitry.
 */
function checkDriverConflict(
  schematic: Schematic,
  nodePinMap: Map<string, Pin[]>,
): ERCViolation[] {
  const results: ERCViolation[] = [];
  for (const node of schematic.nodes) {
    const pins = nodePinMap.get(node.id) ?? [];
    const analogOutputs = pins.filter(p => {
      const type = (p.component as Component | null)?.type ?? '';
      return ANALOG_OUTPUT_TYPES.has(type) && p.direction === PinDirection.Output;
    });
    const digitalInputs = pins.filter(p => {
      const type = (p.component as Component | null)?.type ?? '';
      return DIGITAL_TYPES.has(type) && p.direction === PinDirection.Input;
    });
    if (analogOutputs.length > 0 && digitalInputs.length > 0) {
      const aLabels = analogOutputs.map(p => (p.component as Component).label).join(', ');
      const dLabels = digitalInputs.map(p => (p.component as Component).label).join(', ');
      results.push(violation(
        'ERC_DRIVER_CONFLICT',
        'Analog/Digital Interface',
        'info',
        `Node "${node.name ?? node.id}": analog output (${aLabels}) directly drives digital input (${dLabels}). Verify voltage levels match logic thresholds or add a comparator/level-shifter.`,
        [...analogOutputs, ...digitalInputs].map(p => p.component as Component),
        [node],
      ));
    }
  }
  return results;
}

/**
 * RULE: TRANSISTOR_NO_DRIVE
 * BJT base pin or MOSFET gate pin is not connected to any node.
 * Without a control signal, the transistor cannot switch.
 */
function checkTransistorNoDrive(schematic: Schematic): ERCViolation[] {
  const results: ERCViolation[] = [];
  const transistors = schematic.components.filter(c =>
    c.type === ComponentType.BJT ||
    c.type === ComponentType.NPN ||
    c.type === ComponentType.PNP ||
    c.type === ComponentType.MOSFET ||
    c.type === ComponentType.NMOS ||
    c.type === ComponentType.PMOS ||
    c.type === ComponentType.NJFET ||
    c.type === ComponentType.PJFET,
  );
  for (const t of transistors) {
    // BJT control = Base (B), FET control = Gate (G)
    const controlPin = t.pins.find(p => p.name === 'B' || p.name === 'G');
    if (controlPin && !controlPin.isConnected()) {
      const pinName = controlPin.name === 'B' ? 'Base' : 'Gate';
      results.push(violation(
        'ERC_TRANSISTOR_NO_DRIVE',
        'Transistor Control Pin Floating',
        'warning',
        `${t.label}: ${pinName} pin is not connected. The transistor has no control signal and will have undefined state.`,
        [t], [], [controlPin],
      ));
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────
// Main ERC Runner
// ─────────────────────────────────────────────────────────────

const DEFAULT_RULES: Required<ERCRuleSet> = {
  shortCircuit: true,
  outputConflict: true,
  floatingInput: true,
  missingPowerPin: true,
  reversePolarity: true,
  powerConflict: true,
  fanOut: true,
  noGround: true,
  noCurrentLimit: true,
  voltageExceeded: true,
  driverConflict: true,
  transistorNoDrive: true,
};

/**
 * Run all enabled ERC rules against a schematic.
 *
 * @example
 * const circuit = Circuit('LED Driver', DC(5), R(330), LED(RED), GND());
 * const result = runERC(circuit);
 * if (!result.passed) console.log(result.summary());
 */
export function runERC(schematic: Schematic, options: ERCOptions = {}): ERCResult {
  const rules: Required<ERCRuleSet> = { ...DEFAULT_RULES, ...options.rules };
  const fanOutLimit = options.fanOutLimit ?? 10;

  const nodePinMap = buildNodePinMap(schematic);
  const violations: ERCViolation[] = [];

  if (rules.noGround)          violations.push(...checkNoGround(schematic));
  if (rules.shortCircuit)      violations.push(...checkShortCircuit(schematic, nodePinMap));
  if (rules.outputConflict)    violations.push(...checkOutputConflict(schematic, nodePinMap));
  if (rules.floatingInput)     violations.push(...checkFloatingInput(schematic, nodePinMap));
  if (rules.missingPowerPin)   violations.push(...checkMissingPowerPin(schematic));
  if (rules.reversePolarity)   violations.push(...checkReversePolarity(schematic, nodePinMap));
  if (rules.powerConflict)     violations.push(...checkPowerConflict(schematic, nodePinMap));
  if (rules.fanOut)            violations.push(...checkFanOut(schematic, nodePinMap, fanOutLimit));
  if (rules.noCurrentLimit)    violations.push(...checkNoCurrentLimit(schematic, nodePinMap));
  if (rules.voltageExceeded)   violations.push(...checkVoltageExceeded(schematic, nodePinMap));
  if (rules.driverConflict)    violations.push(...checkDriverConflict(schematic, nodePinMap));
  if (rules.transistorNoDrive) violations.push(...checkTransistorNoDrive(schematic));

  return new ERCResult(violations);
}

// Register runERC on Schematic so schematic.erc() works without circular deps
// This runs once when the erc module is first imported.
Schematic._ercRunner = runERC;
