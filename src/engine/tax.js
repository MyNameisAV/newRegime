// WhichRegime tax engine — FY 2025-26 (AY 2026-27) and FY 2026-27.
// Budget 2026 made no changes to slabs, 87A, surcharge or cess, so one
// engine serves both years. Verified against ClearTax / ITD examples.

export const CESS = 0.04;
export const STD_DED = { new: 75000, old: 50000 };

const NEW_SLABS = [
  [400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15],
  [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30],
];
const OLD_SLABS = [
  [250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30],
];

// Surcharge bands as [threshold, rateAboveThreshold]; new regime capped at 25%.
const SURCHARGE = {
  new: [[5000000, 0.10], [10000000, 0.15], [20000000, 0.25], [50000000, 0.25]],
  old: [[5000000, 0.10], [10000000, 0.15], [20000000, 0.25], [50000000, 0.37]],
};

const REBATE = {
  new: { limit: 1200000, max: 60000 },
  old: { limit: 500000, max: 12500 },
};

function slabTax(taxable, slabs) {
  let tax = 0, prev = 0;
  for (const [cap, rate] of slabs) {
    if (taxable > prev) tax += (Math.min(taxable, cap) - prev) * rate;
    prev = cap;
    if (taxable <= cap) break;
  }
  return tax;
}

// Pre-cess liability including 87A (with marginal relief, new regime)
// and surcharge (with marginal relief at every threshold).
export function preCessLiability(taxable, regime) {
  const slabs = regime === 'new' ? NEW_SLABS : OLD_SLABS;
  let base = slabTax(taxable, slabs);

  const r = REBATE[regime];
  if (taxable <= r.limit) {
    base = Math.max(0, base - r.max);
  } else if (regime === 'new') {
    // 87A marginal relief: payable can't exceed income above ₹12L.
    base = Math.min(base, taxable - r.limit);
  }

  // Surcharge with marginal relief.
  const bands = SURCHARGE[regime];
  let rate = 0, threshold = 0, rateAtThreshold = 0;
  for (let i = bands.length - 1; i >= 0; i--) {
    if (taxable > bands[i][0]) {
      rate = bands[i][1];
      threshold = bands[i][0];
      rateAtThreshold = i > 0 ? bands[i - 1][1] : 0;
      break;
    }
  }
  if (!rate) return base;

  let liability = base + base * rate;
  const taxAtTh = slabTax(threshold, slabs);
  const cap = taxAtTh * (1 + rateAtThreshold) + (taxable - threshold);
  return Math.min(liability, cap);
}

export function totalTax(taxable, regime) {
  return Math.round(preCessLiability(Math.max(0, taxable), regime) * (1 + CESS));
}

// ---- Regime comparison ----------------------------------------------------

export function oldTaxable(gross, d = {}) {
  const ded =
    STD_DED.old +
    Math.min(d.sec80c || 0, 150000) +
    (d.sec80d || 0) +
    (d.hraExempt || 0) +
    Math.min(d.homeLoanInterest || 0, 200000) +
    Math.min(d.nps1b || 0, 50000) +
    (d.employerNps || 0) +
    (d.other || 0);
  return Math.max(0, gross - ded);
}

export function newTaxable(gross, d = {}) {
  return Math.max(0, gross - STD_DED.new - (d.employerNps || 0));
}

export function compareRegimes(gross, d = {}) {
  const tOld = totalTax(oldTaxable(gross, d), 'old');
  const tNew = totalTax(newTaxable(gross, d), 'new');
  const winner = tOld === tNew ? 'tie' : tOld < tNew ? 'old' : 'new';
  return {
    old: { taxable: oldTaxable(gross, d), tax: tOld },
    new: { taxable: newTaxable(gross, d), tax: tNew },
    winner,
    savings: Math.abs(tOld - tNew),
    breakEven: breakEvenDeductions(gross, d.employerNps || 0),
  };
}

// Smallest old-regime deductions D (beyond the ₹50k standard deduction)
// at which old regime matches new. null → old never wins.
export function breakEvenDeductions(gross, employerNps = 0) {
  const target = totalTax(newTaxable(gross, { employerNps }), 'new');
  const taxOldAt = (D) =>
    totalTax(Math.max(0, gross - STD_DED.old - employerNps - D), 'old');
  if (taxOldAt(0) <= target) return 0;
  let lo = 0, hi = gross;
  if (taxOldAt(hi) > target) return null;
  while (hi - lo > 100) {
    const mid = (lo + hi) / 2;
    taxOldAt(mid) > target ? (lo = mid) : (hi = mid);
  }
  return Math.round(hi / 100) * 100;
}

// ---- HRA exemption (least of three) ---------------------------------------

export function hraExempt({ basic = 0, hraReceived = 0, rentPaid = 0, metro = false }) {
  const a = hraReceived;
  const b = Math.max(0, rentPaid - 0.1 * basic);
  const c = (metro ? 0.5 : 0.4) * basic;
  return Math.max(0, Math.min(a, b, c));
}

// ---- Capital gains & crypto (excl. surcharge) ------------------------------

export function capitalGainsTax({ stcgEquity = 0, ltcgEquity = 0, ltcgOther = 0, crypto = 0 }) {
  const parts = {
    stcgEquity: stcgEquity * 0.20,
    ltcgEquity: Math.max(0, ltcgEquity - 125000) * 0.125,
    ltcgOther: ltcgOther * 0.125,
    crypto: crypto * 0.30,
  };
  const preCess = Object.values(parts).reduce((s, v) => s + v, 0);
  return { parts, total: Math.round(preCess * (1 + CESS)) };
}

// ---- SIP projection ---------------------------------------------------------

export function sipProjection({ monthly, annualReturnPct, years, stepUpPct = 0 }) {
  const r = annualReturnPct / 100 / 12;
  let value = 0, invested = 0, sip = monthly;
  const points = [];
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      value = (value + sip) * (1 + r);
      invested += sip;
    }
    points.push({ year: y, invested: Math.round(invested), value: Math.round(value) });
    sip = Math.round(sip * (1 + stepUpPct / 100));
  }
  return points;
}

// ---- Loan affordability (FOIR 45%) -----------------------------------------

export function affordability({ netMonthlyIncome, existingEmi = 0, ratePct, tenureYears }) {
  const maxEmi = Math.max(0, netMonthlyIncome * 0.45 - existingEmi);
  const r = ratePct / 100 / 12;
  const n = tenureYears * 12;
  const loan = r > 0 ? maxEmi * (1 - Math.pow(1 + r, -n)) / r : maxEmi * n;
  return {
    maxEmi: Math.round(maxEmi),
    maxLoan: Math.round(loan),
    indicativeBudget: Math.round(loan / 0.8),
  };
}
