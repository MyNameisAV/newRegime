import test from 'node:test';
import assert from 'node:assert/strict';
import {
  totalTax, compareRegimes, newTaxable, hraExempt,
  capitalGainsTax, breakEvenDeductions,
} from '../src/engine/tax.js';

// External anchors — cross-checked against ClearTax / ITD published examples.

test('new regime: ₹12.75L salary → zero tax (SD + 87A)', () => {
  assert.equal(totalTax(newTaxable(1275000), 'new'), 0);
});

test('new regime: ₹15L salary → ₹97,500 incl. cess (ClearTax anchor)', () => {
  assert.equal(totalTax(newTaxable(1500000), 'new'), 97500);
});

test('new regime: 87A marginal relief at ₹12.5L taxable → ₹50k pre-cess', () => {
  assert.equal(totalTax(1250000, 'new'), Math.round(50000 * 1.04));
});

test('new regime: relief crossover ends ~₹12.71L', () => {
  // Above crossover, plain slab tax applies again.
  assert.equal(totalTax(1300000, 'new'), Math.round(75000 * 1.04));
});

test('old regime: ₹5L taxable → zero (87A)', () => {
  assert.equal(totalTax(500000, 'old'), 0);
});

test('old regime: surcharge marginal relief at ₹51L taxable', () => {
  // Slab tax 13,42,500; +10% = 14,76,750; capped at 13,12,500 + 1,00,000.
  assert.equal(totalTax(5100000, 'old'), Math.round(1412500 * 1.04));
});

test('old regime: no relief needed at ₹60L', () => {
  const slab = 12500 + 100000 + (6000000 - 1000000) * 0.3; // 16,12,500
  assert.equal(totalTax(6000000, 'old'), Math.round(slab * 1.1 * 1.04));
});

test('compare: ₹16L salary, no deductions → new wins', () => {
  const r = compareRegimes(1600000, {});
  assert.equal(r.winner, 'new');
  assert.equal(r.new.tax, 113100);
});

test('break-even: ₹16L salary → ≈₹5.69L of old-regime deductions', () => {
  const be = breakEvenDeductions(1600000);
  assert.ok(Math.abs(be - 568800) < 2500, `got ${be}`);
});

test('HRA: least-of-three, metro', () => {
  assert.equal(
    hraExempt({ basic: 600000, hraReceived: 240000, rentPaid: 300000, metro: true }),
    240000,
  );
});

test('capital gains: LTCG equity ₹2L → ₹9,750 (₹1.25L exemption)', () => {
  assert.equal(capitalGainsTax({ ltcgEquity: 200000 }).total, 9750);
});

test('crypto: ₹1L gain → ₹31,200 flat 30% + cess', () => {
  assert.equal(capitalGainsTax({ crypto: 100000 }).total, 31200);
});
