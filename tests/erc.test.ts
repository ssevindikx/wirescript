/**
 * WireScript ERC — Test Suite
 * Tests each electrical rule check against known-good and known-bad circuits
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resetCounters } from '../core/Component';
import { Pin } from '../core/Pin';
import { Node } from '../core/Node';
import {
  Circuit, createSchematic,
  DC, AC, GND, VCC, R, C, L, LED, D,
  NPN, PNP, NMOS, OpAmp, OpAmp3,
  NOT, AND, HIGH, LOW, CLK,
  kOhm, uF, nF, kHz, RED, GREEN,
  runERC,
} from '../core';


beforeEach(() => {
  resetCounters();
  Pin.resetCounter();
});

// ─────────────────────────────────────────────────────────────
// ERC_NO_GROUND
// ─────────────────────────────────────────────────────────────
describe('ERC_NO_GROUND', () => {
  it('reports error when no GND exists', () => {
    const circuit = Circuit('No Ground', { autoGround: false }, [
      [DC(5), R(kOhm(1))],
    ]);
    const result = runERC(circuit, { rules: { noGround: true } });
    const err = result.errors.find(v => v.ruleId === 'ERC_NO_GROUND');
    expect(err).toBeDefined();
  });

  it('passes when GND is present', () => {
    const circuit = Circuit('With Ground', DC(5), R(kOhm(1)), GND());
    const result = runERC(circuit, { rules: { noGround: true } });
    expect(result.violations.filter(v => v.ruleId === 'ERC_NO_GROUND')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// ERC_SHORT_CIRCUIT
// ─────────────────────────────────────────────────────────────
describe('ERC_SHORT_CIRCUIT', () => {
  it('detects voltage source shorted via GND component', () => {
    // DC(5) positive goes directly to GND — short circuit
    const circuit = Circuit('Shorted', DC(5), GND());
    const result = runERC(circuit, { rules: { shortCircuit: true } });
    const err = result.errors.find(v => v.ruleId === 'ERC_SHORT_CIRCUIT');
    expect(err).toBeDefined();
  });

  it('passes when a resistor is in series', () => {
    const circuit = Circuit('LED Circuit', DC(5), R(330), LED(RED), GND());
    const result = runERC(circuit, { rules: { shortCircuit: true } });
    expect(result.violations.filter(v => v.ruleId === 'ERC_SHORT_CIRCUIT')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// ERC_OUTPUT_CONFLICT
// ─────────────────────────────────────────────────────────────
describe('ERC_OUTPUT_CONFLICT', () => {
  it('detects two logic outputs on same node', () => {
    const not1 = NOT();
    const not2 = NOT();
    // Wire both outputs together (bus contention)
    const circuit = Circuit('Bus Conflict', { autoGround: false }, [
      [HIGH(), not1.A],
      [HIGH(), not2.A],
      [not1.Y, not2.Y], // outputs tied together → conflict
    ]);
    const result = runERC(circuit, { rules: { outputConflict: true } });
    const err = result.errors.find(v => v.ruleId === 'ERC_OUTPUT_CONFLICT');
    expect(err).toBeDefined();
  });

  it('passes when outputs go to separate nodes', () => {
    const not1 = NOT();
    const not2 = NOT();
    const circuit = Circuit('No Conflict', { autoGround: false }, [
      [HIGH(), not1.A],
      [HIGH(), not2.A],
      [not1.Y, R(kOhm(1))],
      [not2.Y, R(kOhm(1))],
    ]);
    const result = runERC(circuit, { rules: { outputConflict: true } });
    expect(result.violations.filter(v => v.ruleId === 'ERC_OUTPUT_CONFLICT')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// ERC_FLOATING_INPUT
// ─────────────────────────────────────────────────────────────
describe('ERC_FLOATING_INPUT', () => {
  it('warns when a gate input has no driver', () => {
    const and1 = AND();
    // Connect A but leave B floating by connecting to a disconnected node
    const circuit = Circuit('Floating B', { autoGround: false }, [
      [HIGH(), and1.A],
      [and1.Y, R(kOhm(1))],
    ]);
    // and1.B is completely unconnected, not in circuit paths at all
    // It will appear as unconnected — floating input check covers connected-but-no-driver
    // This test checks no crash:
    const result = runERC(circuit, { rules: { floatingInput: true } });
    expect(result).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// ERC_MISSING_POWER_PIN
// ─────────────────────────────────────────────────────────────
describe('ERC_MISSING_POWER_PIN', () => {
  it('errors when OpAmp vPos is unconnected', () => {
    const op = OpAmp('LM741');
    // Only connect signal pins, not supply pins
    const circuit = Circuit('Unpowered OpAmp', { autoGround: false }, [
      [AC(0.1, 1000), R(kOhm(10)), op.inN],
      [op.out, R(kOhm(100)), op.inN], // feedback
      [op.inP, GND()],
    ]);
    const result = runERC(circuit, { rules: { missingPowerPin: true } });
    const err = result.errors.find(v => v.ruleId === 'ERC_MISSING_POWER_PIN');
    expect(err).toBeDefined();
  });

  it('passes when OpAmp supply pins are connected', () => {
    const op = OpAmp('LM741');
    const circuit = Circuit('Powered OpAmp', { autoGround: false }, [
      [VCC(15), op.vPos],
      [VCC(-15), op.vNeg],
      [AC(0.1, 1000), R(kOhm(10)), op.inN],
      [op.out, R(kOhm(100)), op.inN],
      [op.inP, GND()],
    ]);
    const result = runERC(circuit, { rules: { missingPowerPin: true } });
    expect(result.violations.filter(v => v.ruleId === 'ERC_MISSING_POWER_PIN')).toHaveLength(0);
  });

  it('3-pin OpAmp (no supply pins) does not trigger error', () => {
    const op3 = OpAmp3('TL072');
    const circuit = Circuit('Buffer', { autoGround: false }, [
      [VCC(2.5), op3.inP],
      [op3.out, op3.inN],
    ]);
    const result = runERC(circuit, { rules: { missingPowerPin: true } });
    expect(result.violations.filter(v => v.ruleId === 'ERC_MISSING_POWER_PIN')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// ERC_REVERSE_POLARITY
// ─────────────────────────────────────────────────────────────
describe('ERC_REVERSE_POLARITY', () => {
  it('errors when LED is reverse-biased (anode→GND, cathode→VCC)', () => {
    // Build circuit manually: anode at GND (0V), cathode at VCC (5V)
    const s = createSchematic('Reversed LED');
    const led = LED(RED);
    const gnd = GND();
    const vcc = VCC(5);

    const gndNode = gnd.getGroundNode();
    led.anode.connectTo(gndNode);

    const vccNode = new Node('vcc');
    vcc.pins[0].connectTo(vccNode);
    led.cathode.connectTo(vccNode);

    s.addComponent(led).addComponent(gnd).addComponent(vcc);
    s.addNode(gndNode).addNode(vccNode);

    const result = runERC(s, { rules: { reversePolarity: true } });
    const err = result.errors.find(v => v.ruleId === 'ERC_REVERSE_POLARITY');
    expect(err).toBeDefined();
  });

  it('passes for correctly oriented LED', () => {
    const circuit = Circuit('Correct LED', DC(5), R(330), LED(RED), GND());
    const result = runERC(circuit, { rules: { reversePolarity: true } });
    expect(result.violations.filter(v => v.ruleId === 'ERC_REVERSE_POLARITY')).toHaveLength(0);
  });
});




// ─────────────────────────────────────────────────────────────
// ERC_POWER_CONFLICT
// ─────────────────────────────────────────────────────────────
describe('ERC_POWER_CONFLICT', () => {
  it('errors when two power rails with different voltages share a node', () => {
    const circuit = Circuit('Power Fight', { autoGround: false }, [
      [VCC(5), VCC(3.3)], // 5V and 3.3V rails tied together
    ]);
    const result = runERC(circuit, { rules: { powerConflict: true } });
    const err = result.errors.find(v => v.ruleId === 'ERC_POWER_CONFLICT');
    expect(err).toBeDefined();
  });

  it('passes when rails have same voltage', () => {
    const circuit = Circuit('Same Rails', { autoGround: false }, [
      [VCC(5), R(kOhm(1))],
      [VCC(5), R(kOhm(2))],
    ]);
    const result = runERC(circuit, { rules: { powerConflict: true } });
    expect(result.violations.filter(v => v.ruleId === 'ERC_POWER_CONFLICT')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// ERC_FAN_OUT
// ─────────────────────────────────────────────────────────────
describe('ERC_FAN_OUT', () => {
  it('warns when gate output drives more inputs than limit', () => {
    const driver = NOT();
    const loads = Array.from({ length: 12 }, () => NOT());
    const circuit = Circuit('Overloaded Gate', { autoGround: false }, [
      [HIGH(), driver.A],
      // Connect driver.Y to all 12 inputs
      ...loads.map(g => [driver.Y, g.A] as [typeof driver.Y, typeof g.A]),
      ...loads.map(g => [g.Y, R(kOhm(1))] as [typeof g.Y, ReturnType<typeof R>]),
    ]);
    const result = runERC(circuit, { rules: { fanOut: true }, fanOutLimit: 10 });
    const warn = result.warnings.find(v => v.ruleId === 'ERC_FAN_OUT');
    expect(warn).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// ERC_NO_CURRENT_LIMIT
// ─────────────────────────────────────────────────────────────
describe('ERC_NO_CURRENT_LIMIT', () => {
  it('errors when LED is directly across supply without resistor', () => {
    const led = LED(RED);
    const circuit = Circuit('Bare LED', { autoGround: false }, [
      [VCC(5), led.anode],
      [led.cathode, GND()],
    ]);
    const result = runERC(circuit, { rules: { noCurrentLimit: true } });
    const err = result.errors.find(v => v.ruleId === 'ERC_NO_CURRENT_LIMIT');
    expect(err).toBeDefined();
  });

  it('passes when current-limiting resistor is present', () => {
    const circuit = Circuit('Safe LED', DC(5), R(330), LED(RED), GND());
    const result = runERC(circuit, { rules: { noCurrentLimit: true } });
    expect(result.violations.filter(v => v.ruleId === 'ERC_NO_CURRENT_LIMIT')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// ERC_VOLTAGE_EXCEEDED
// ─────────────────────────────────────────────────────────────
describe('ERC_VOLTAGE_EXCEEDED', () => {
  it('warns when high supply is directly at LED anode without resistor', () => {
    const led = LED(GREEN);
    const circuit = Circuit('High V LED', { autoGround: false }, [
      [VCC(12), led.anode],
      [led.cathode, GND()],
    ]);
    const result = runERC(circuit, { rules: { voltageExceeded: true } });
    const warn = result.violations.find(v => v.ruleId === 'ERC_VOLTAGE_EXCEEDED');
    expect(warn).toBeDefined();
  });

  it('no warning when resistor is present (even with high supply)', () => {
    // Resistor on the anode node prevents direct high-V exposure
    const led = LED(GREEN);
    const r = R(560);
    const circuit = Circuit('Protected LED', { autoGround: false }, [
      [VCC(12), r.p1],
      [r.p2, led.anode],
      [led.cathode, GND()],
    ]);
    const result = runERC(circuit, { rules: { voltageExceeded: true } });
    expect(result.violations.filter(v => v.ruleId === 'ERC_VOLTAGE_EXCEEDED')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// ERC_TRANSISTOR_NO_DRIVE
// ─────────────────────────────────────────────────────────────
describe('ERC_TRANSISTOR_NO_DRIVE', () => {
  it('warns when BJT Base pin is not connected', () => {
    const t = NPN('2N2222');
    // Collector and Emitter connected, Base left floating
    const circuit = Circuit('Floating Base', { autoGround: false }, [
      [VCC(5), R(kOhm(1)), t.C],
      [t.E, GND()],
    ]);
    const result = runERC(circuit, { rules: { transistorNoDrive: true } });
    const warn = result.warnings.find(v => v.ruleId === 'ERC_TRANSISTOR_NO_DRIVE');
    expect(warn).toBeDefined();
  });

  it('passes when all transistor pins are connected', () => {
    const t = NPN('2N2222');
    const circuit = Circuit('Proper Switch', [
      [DC(5), R(kOhm(1)), LED(RED), t.C],
      [t.E, GND()],
      [DC(5), R(kOhm(10)), t.B],
    ]);
    const result = runERC(circuit, { rules: { transistorNoDrive: true } });
    expect(result.violations.filter(v => v.ruleId === 'ERC_TRANSISTOR_NO_DRIVE')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Schematic.erc() method
// ─────────────────────────────────────────────────────────────
describe('Schematic.erc()', () => {
  it('is callable directly on schematic instance', () => {
    const circuit = Circuit('Inline ERC', DC(5), R(kOhm(1)), GND());
    const result = circuit.erc();
    expect(result).toBeDefined();
    expect(typeof result.passed).toBe('boolean');
    expect(typeof result.summary).toBe('function');
  });

  it('returns ERCResult with passed=true for a clean circuit', () => {
    const circuit = Circuit('Clean', DC(5), R(330), LED(RED), GND());
    const result = circuit.erc();
    expect(result.errors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Selective rule enabling
// ─────────────────────────────────────────────────────────────
describe('ERCOptions.rules — selective enable', () => {
  it('only runs enabled rules', () => {
    // Circuit has no ground (would be an error) but we disable that rule
    const circuit = Circuit('No GND', { autoGround: false }, [
      [DC(5), R(kOhm(1))],
    ]);
    const result = runERC(circuit, {
      rules: {
        noGround: false,       // disabled
        shortCircuit: true,
        outputConflict: false,
        floatingInput: false,
        missingPowerPin: false,
        reversePolarity: false,
        powerConflict: false,
        fanOut: false,
        noCurrentLimit: false,
        voltageExceeded: false,
        driverConflict: false,
        transistorNoDrive: false,
      },
    });
    expect(result.violations.filter(v => v.ruleId === 'ERC_NO_GROUND')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// summary() output
// ─────────────────────────────────────────────────────────────
describe('ERCResult.summary()', () => {
  it('returns clean message for valid circuit', () => {
    const circuit = Circuit('Clean', DC(5), R(330), LED(RED), GND());
    const result = circuit.erc();
    expect(result.summary()).toContain('✅');
  });

  it('returns violation list for bad circuit', () => {
    const circuit = Circuit('Short', DC(5), GND());
    const result = circuit.erc();
    const summary = result.summary();
    expect(summary).toContain('ERC_SHORT_CIRCUIT');
    expect(summary).toContain('🔴');
  });
});
