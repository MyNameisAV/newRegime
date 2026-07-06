import { useMemo, useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import {
  compareRegimes, hraExempt, capitalGainsTax, sipProjection, affordability, STD_DED,
} from './engine/tax.js';

// ---------------------------------------------------------------- helpers
const inr = (n) =>
  '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

const track = (params) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'calculate', params);
  }
};

const YEAR_MODES = {
  filing: {
    label: 'FY 2025-26 (AY 2026-27)',
    tag: 'Filing ITR now — due 31 Jul 2026',
  },
  planning: {
    label: 'FY 2026-27 (Tax Year 2026-27)',
    tag: 'Planning the current year',
  },
};

function Num({ label, value, onChange, hint, prefix = '₹' }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1 flex items-center rounded-xl border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-emerald-500">
        <span className="pl-3 text-slate-400 text-sm">{prefix}</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
          className="w-full rounded-xl px-2 py-2.5 outline-none text-slate-900"
          placeholder="0"
        />
      </div>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function Card({ title, children, subtitle }) {
  return (
    <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-5 space-y-4">
      {title && (
        <header>
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

// ------------------------------------------------------- Regime comparison
function RegimeCompare() {
  const [gross, setGross] = useState(1600000);
  const [d, setD] = useState({
    sec80c: 0, sec80d: 0, homeLoanInterest: 0, nps1b: 0, employerNps: 0, other: 0,
  });
  const [hra, setHra] = useState({ basic: 0, hraReceived: 0, rentPaid: 0, metro: true });
  const fired = useRef(false);

  const hraEx = useMemo(() => hraExempt(hra), [hra]);
  const result = useMemo(
    () => compareRegimes(Number(gross) || 0, { ...d, hraExempt: hraEx }),
    [gross, d, hraEx],
  );

  const set = (k) => (v) => {
    setD((p) => ({ ...p, [k]: v }));
    if (!fired.current && gross) { fired.current = true; track({ calculator: 'regime', regime_winner: result.winner }); }
  };
  const setGrossTracked = (v) => {
    setGross(v);
    if (!fired.current && v) { fired.current = true; track({ calculator: 'regime', regime_winner: result.winner }); }
  };

  const winnerText = {
    new: 'New regime wins',
    old: 'Old regime wins',
    tie: 'Both regimes are equal',
  }[result.winner];

  return (
    <div className="space-y-4">
      <Card title="Your income">
        <Num label="Gross annual salary" value={gross} onChange={setGrossTracked} />
        <Num
          label="Employer NPS — 80CCD(2)"
          value={d.employerNps}
          onChange={set('employerNps')}
          hint="Allowed in both regimes"
        />
      </Card>

      <Card
        title="Old-regime deductions"
        subtitle={`Standard deduction ${inr(STD_DED.old)} (old) / ${inr(STD_DED.new)} (new) is applied automatically.`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Num label="80C (PF, ELSS, LIC…)" value={d.sec80c} onChange={set('sec80c')} hint="Capped at ₹1,50,000" />
          <Num label="80D (health insurance)" value={d.sec80d} onChange={set('sec80d')} />
          <Num label="Home loan interest — 24(b)" value={d.homeLoanInterest} onChange={set('homeLoanInterest')} hint="Capped at ₹2,00,000" />
          <Num label="NPS self — 80CCD(1B)" value={d.nps1b} onChange={set('nps1b')} hint="Capped at ₹50,000" />
          <Num label="Other (80G, 80E, 80TTA…)" value={d.other} onChange={set('other')} />
        </div>

        <details className="rounded-xl bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            HRA exemption calculator {hraEx > 0 && <span className="text-emerald-600">— {inr(hraEx)} exempt</span>}
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Num label="Basic salary (annual)" value={hra.basic} onChange={(v) => setHra((p) => ({ ...p, basic: v }))} />
            <Num label="HRA received (annual)" value={hra.hraReceived} onChange={(v) => setHra((p) => ({ ...p, hraReceived: v }))} />
            <Num label="Rent paid (annual)" value={hra.rentPaid} onChange={(v) => setHra((p) => ({ ...p, rentPaid: v }))} />
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
              <input
                type="checkbox"
                checked={hra.metro}
                onChange={(e) => setHra((p) => ({ ...p, metro: e.target.checked }))}
                className="accent-emerald-600 h-4 w-4"
              />
              Metro city (Delhi, Mumbai, Kolkata, Chennai)
            </label>
          </div>
          <p className="text-xs text-slate-400 mt-2">Exemption = least of HRA received, rent − 10% of basic, 50%/40% of basic.</p>
        </details>
      </Card>

      <Card>
        <div className="text-center space-y-1">
          <p className={`text-xl font-bold ${result.winner === 'old' ? 'text-amber-600' : 'text-emerald-600'}`}>
            {winnerText}
          </p>
          {result.winner !== 'tie' && (
            <p className="text-slate-600">You save <b>{inr(result.savings)}</b> a year</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          {['old', 'new'].map((r) => (
            <div
              key={r}
              className={`rounded-xl border p-4 ${result.winner === r ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">{r} regime</p>
              <p className="text-lg font-semibold text-slate-800">{inr(result[r].tax)}</p>
              <p className="text-xs text-slate-400">on taxable {inr(result[r].taxable)}</p>
            </div>
          ))}
        </div>
        {result.breakEven !== null && result.breakEven > 0 && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
            Break-even: the old regime beats the new one only if your deductions
            (beyond the standard deduction) exceed <b>{inr(result.breakEven)}</b>.
          </p>
        )}
        {result.breakEven === 0 && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
            At this income, the old regime already matches or beats the new regime with your current deductions.
          </p>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------ Capital gains
function CapitalGains() {
  const [g, setG] = useState({ stcgEquity: 0, ltcgEquity: 0, ltcgOther: 0, crypto: 0 });
  const fired = useRef(false);
  const res = useMemo(() => capitalGainsTax(g), [g]);
  const set = (k) => (v) => {
    setG((p) => ({ ...p, [k]: v }));
    if (!fired.current) { fired.current = true; track({ calculator: 'capital_gains' }); }
  };
  const rows = [
    ['Equity STCG (≤12 months) — 20%', res.parts.stcgEquity],
    ['Equity LTCG — 12.5% above ₹1.25L exemption', res.parts.ltcgEquity],
    ['Other LTCG (property, gold…) — 12.5%', res.parts.ltcgOther],
    ['Crypto / VDA — flat 30%, no loss set-off', res.parts.crypto],
  ];
  return (
    <div className="space-y-4">
      <Card title="Gains this year">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Num label="Equity STCG" value={g.stcgEquity} onChange={set('stcgEquity')} />
          <Num label="Equity LTCG" value={g.ltcgEquity} onChange={set('ltcgEquity')} />
          <Num label="Other LTCG" value={g.ltcgOther} onChange={set('ltcgOther')} />
          <Num label="Crypto / VDA gains" value={g.crypto} onChange={set('crypto')} />
        </div>
      </Card>
      <Card title="Tax on gains" subtitle="Includes 4% cess · excludes surcharge">
        <ul className="divide-y divide-slate-100">
          {rows.map(([label, v]) => (
            <li key={label} className="flex justify-between py-2 text-sm">
              <span className="text-slate-600">{label}</span>
              <span className="font-medium text-slate-800">{inr(v)}</span>
            </li>
          ))}
        </ul>
        <p className="text-right text-lg font-bold text-slate-800">Total: {inr(res.total)}</p>
        <p className="text-xs text-slate-400">Crypto also attracts 1% TDS on transfers under section 194S.</p>
      </Card>
    </div>
  );
}

// -------------------------------------------------------------- SIP planner
function SipPlanner() {
  const [s, setS] = useState({ monthly: 25000, annualReturnPct: 12, years: 15, stepUpPct: 10 });
  const fired = useRef(false);
  const points = useMemo(() => sipProjection(s), [s]);
  const last = points[points.length - 1] || { invested: 0, value: 0 };
  const set = (k, prefix) => (v) => {
    setS((p) => ({ ...p, [k]: v }));
    if (!fired.current) { fired.current = true; track({ calculator: 'sip' }); }
  };
  return (
    <div className="space-y-4">
      <Card title="SIP inputs">
        <div className="grid grid-cols-2 gap-4">
          <Num label="Monthly SIP" value={s.monthly} onChange={set('monthly')} />
          <Num label="Expected return %" prefix="%" value={s.annualReturnPct} onChange={set('annualReturnPct')} />
          <Num label="Years" prefix="#" value={s.years} onChange={set('years')} />
          <Num label="Annual step-up %" prefix="%" value={s.stepUpPct} onChange={set('stepUpPct')} />
        </div>
      </Card>
      <Card title={`Projected corpus: ${inr(last.value)}`} subtitle={`Invested ${inr(last.invested)} · gains ${inr(last.value - last.invested)}`}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => (v >= 1e7 ? (v / 1e7).toFixed(1) + 'Cr' : (v / 1e5).toFixed(0) + 'L')} tick={{ fontSize: 12 }} width={48} />
              <Tooltip formatter={(v) => inr(v)} />
              <Legend />
              <Line type="monotone" dataKey="invested" name="Invested" stroke="#94a3b8" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="value" name="Value" stroke="#059669" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-400">Projection only — returns are not guaranteed. Equity LTCG tax applies on redemption.</p>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------ Affordability
function Affordability() {
  const [a, setA] = useState({ netMonthlyIncome: 150000, existingEmi: 0, ratePct: 8.5, tenureYears: 20 });
  const fired = useRef(false);
  const res = useMemo(() => affordability(a), [a]);
  const set = (k) => (v) => {
    setA((p) => ({ ...p, [k]: v }));
    if (!fired.current) { fired.current = true; track({ calculator: 'affordability' }); }
  };
  return (
    <div className="space-y-4">
      <Card title="Loan affordability">
        <div className="grid grid-cols-2 gap-4">
          <Num label="Net monthly income" value={a.netMonthlyIncome} onChange={set('netMonthlyIncome')} />
          <Num label="Existing EMIs / month" value={a.existingEmi} onChange={set('existingEmi')} />
          <Num label="Interest rate %" prefix="%" value={a.ratePct} onChange={set('ratePct')} />
          <Num label="Tenure (years)" prefix="#" value={a.tenureYears} onChange={set('tenureYears')} />
        </div>
      </Card>
      <Card>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[['Max EMI', res.maxEmi], ['Max loan', res.maxLoan], ['Property budget', res.indicativeBudget]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">{l}</p>
              <p className="font-semibold text-slate-800">{inr(v)}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          Assumes lenders cap total EMIs at 45% of net income (FOIR) and 20% down payment. Indicative only.
        </p>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------- FAQ
const FAQ = [
  ['Which tax regime is the default?', 'The new tax regime is the default. You can still opt for the old regime if it results in lower tax — salaried taxpayers can choose either regime each year when filing their return.'],
  ['Can I switch regimes at ITR filing even if my employer deducted TDS under the other one?', 'Yes. Salaried taxpayers pick the regime at filing time, whatever they declared to their employer. Any excess TDS comes back as a refund.'],
  ['Is income up to ₹12.75 lakh really tax-free?', 'Under the new regime, yes for salaried taxpayers: the ₹75,000 standard deduction brings ₹12.75L down to ₹12L taxable, and the Section 87A rebate then reduces the tax to zero. Special-rate income like capital gains is not covered by the rebate.'],
  ['Did Budget 2026 change the tax slabs?', 'No. Budget 2026 made no changes to slab rates, the 87A rebate, surcharge or cess under either regime — the same rates apply to FY 2025-26 and FY 2026-27. The Income Tax Act, 2025 that took effect on 1 April 2026 changes terminology and process, not these rates.'],
  ['When is the old regime still worth it?', 'When your deductions are large: typically a home loan plus HRA plus full 80C. Use the break-even figure this tool shows — if your total deductions exceed it, the old regime wins.'],
];

// ---------------------------------------------------------------------- App
const TABS = [
  ['regime', 'Old vs New'],
  ['gains', 'Capital gains'],
  ['sip', 'SIP planner'],
  ['emi', 'Affordability'],
];

export default function App() {
  const [tab, setTab] = useState('regime');
  const [mode, setMode] = useState(new Date() < new Date('2026-08-01') ? 'filing' : 'planning');

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <header className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-bold tracking-tight">
              Which<span className="text-emerald-600">Regime</span>
            </h1>
            <span className="text-xs text-slate-500">India income-tax & money planner</span>
          </div>

          <div className="flex gap-2">
            {Object.entries(YEAR_MODES).map(([k, m]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`flex-1 rounded-xl px-3 py-2 text-sm border transition ${
                  mode === k
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-600 border-slate-300'
                }`}
              >
                <span className="block font-medium">{m.label}</span>
                <span className={`block text-xs ${mode === k ? 'text-emerald-100' : 'text-slate-400'}`}>{m.tag}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
            Slabs unchanged in Budget 2026 — the same rates apply to both years, so every figure below is valid whichever year you pick.
          </p>

          <nav className="flex gap-1 rounded-xl bg-white border border-slate-200 p-1">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 rounded-lg px-2 py-2 text-sm ${
                  tab === k ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>

        {tab === 'regime' && <RegimeCompare />}
        {tab === 'gains' && <CapitalGains />}
        {tab === 'sip' && <SipPlanner />}
        {tab === 'emi' && <Affordability />}

        <Card title="FAQ">
          <div className="divide-y divide-slate-100">
            {FAQ.map(([q, a]) => (
              <details key={q} className="py-2">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">{q}</summary>
                <p className="text-sm text-slate-600 mt-1">{a}</p>
              </details>
            ))}
          </div>
        </Card>

        <footer className="text-xs text-slate-500 space-y-2.5 px-1 pb-6">
          <p>
            <b className="text-slate-700 font-semibold">Not advice.</b> This tool provides general information and estimates only. It is not tax, legal, investment, or financial advice. Consult a qualified professional before acting on any output.
          </p>
          <p>
            <b className="text-slate-700 font-semibold">No warranty.</b> This tool is provided “as is”, without warranty of any kind, express or implied. To the maximum extent permitted by law, the creator accepts no liability for any loss, damage, or consequence arising from its use or from reliance on its output.
          </p>
          <p>
            <b className="text-slate-700 font-semibold">Privacy.</b> All calculations run entirely in your browser. No personal or financial information you enter is collected, transmitted, or stored on any server.
          </p>
          <p>
            Built by <a href="https://www.linkedin.com/in/atul-kumar-a8a21446" className="text-emerald-700 underline" rel="author">Atul Kumar</a>
          </p>
          <p className="text-slate-400 pt-2.5 border-t border-slate-200">
            © 2026 WhichRegime. All rights reserved. WhichRegime is an independent tool and is not affiliated with, endorsed by, or connected to the Income Tax Department or the Government of India.
          </p>
        </footer>
      </div>
    </div>
  );
}
