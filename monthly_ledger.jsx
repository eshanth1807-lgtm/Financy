import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Rent / Housing', 'Food & Groceries', 'Transport', 'Utilities',
  'EMI / Debt', 'Healthcare', 'Entertainment', 'Education',
  'Subscriptions', 'Other',
];

const CATEGORY_TIPS = {
  'Rent / Housing': "Housing is your biggest line. If it's above 30% of income, a smaller place, a flatmate, or renegotiating rent could ease the load.",
  'Food & Groceries': 'Food costs add up in small purchases. Planning meals for the week and cooking at home more often usually cuts this fastest.',
  'Transport': 'Transport often shrinks with carpooling, public transport, or combining errands into fewer trips.',
  'Utilities': 'Small habits — switching off unused appliances, fixing leaks, using efficient bulbs — chip away at utility bills over months.',
  'EMI / Debt': 'High EMI or debt payments limit flexibility. Clearing the highest-interest debt first usually saves the most over time.',
  'Healthcare': 'Healthcare spend is often necessary — check if recurring medicines or tests have cheaper generic options.',
  'Entertainment': "Entertainment is usually the easiest place to trim without hurting daily life — try a fixed monthly cap.",
  'Education': 'Education pays off long term, but check for scholarships, free resources, or annual-instead-of-monthly discounts.',
  'Subscriptions': 'Subscriptions quietly drain money every month. A quick audit of what is actually used often frees up real cash.',
  'Other': 'Untracked, miscellaneous spending is often the biggest hidden leak — worth a closer look.',
};

const GENERIC_TIPS = [
  'Set money aside the moment income arrives, rather than saving whatever is left at the end.',
  'Track every expense for one month, even small ones — it is the fastest way to see where money actually goes.',
  'Follow a rough 50/30/20 split: needs, wants, and savings, and rebalance whichever slice has grown too large.',
  'A small emergency fund, even a little each month, stops a bad month from turning into debt.',
];

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const emptyIncome = () => [{ id: genId(), label: '', amount: '' }];
const emptyExpenses = () => [{ id: genId(), category: EXPENSE_CATEGORIES[0], amount: '' }];

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function formatCurrency(amount, currency) {
  const locale = currency === 'INR' ? 'en-IN' : currency === 'EUR' ? 'de-DE' : currency === 'GBP' ? 'en-GB' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount || 0);
  } catch {
    return `${amount || 0}`;
  }
}

export default function MonthlyLedger() {
  const [currency, setCurrency] = useState('INR');
  const [monthDate, setMonthDate] = useState(currentMonth());
  const [income, setIncome] = useState(emptyIncome);
  const [expenses, setExpenses] = useState(emptyExpenses);
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState({});
  const [justSaved, setJustSaved] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const skipSaveRef = useRef(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get('ledger:index', false);
        setHistory(res ? JSON.parse(res.value) : {});
      } catch {
        setHistory({});
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      let data = null;
      try {
        const res = await window.storage.get(`ledger:${monthDate}`, false);
        data = res ? JSON.parse(res.value) : null;
      } catch {
        data = null;
      }
      if (cancelled) return;
      skipSaveRef.current = true;
      setIncome(data?.income?.length ? data.income : emptyIncome());
      setExpenses(data?.expenses?.length ? data.expenses : emptyExpenses());
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [monthDate]);

  useEffect(() => {
    if (!ready) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    const t = setTimeout(async () => {
      const ti = income.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      const te = expenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      try {
        await window.storage.set(`ledger:${monthDate}`, JSON.stringify({ income, expenses }), false);
        const newIndex = { ...history, [monthDate]: { income: ti, expense: te, net: ti - te } };
        await window.storage.set('ledger:index', JSON.stringify(newIndex), false);
        setHistory(newIndex);
        setStorageError(false);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 1600);
      } catch {
        setStorageError(true);
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [income, expenses, ready]);

  const updateIncome = (id, field, val) => setIncome(p => p.map(r => (r.id === id ? { ...r, [field]: val } : r)));
  const updateExpense = (id, field, val) => setExpenses(p => p.map(r => (r.id === id ? { ...r, [field]: val } : r)));
  const addIncome = () => setIncome(p => [...p, { id: genId(), label: '', amount: '' }]);
  const addExpense = () => setExpenses(p => [...p, { id: genId(), category: EXPENSE_CATEGORIES[0], amount: '' }]);
  const removeIncome = (id) => setIncome(p => (p.length > 1 ? p.filter(r => r.id !== id) : p));
  const removeExpense = (id) => setExpenses(p => (p.length > 1 ? p.filter(r => r.id !== id) : p));

  const totalIncome = income.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalExpense = expenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const net = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? net / totalIncome : null;

  const catMap = {};
  expenses.forEach(r => {
    const amt = parseFloat(r.amount) || 0;
    if (amt > 0) catMap[r.category] = (catMap[r.category] || 0) + amt;
  });
  const catTotals = Object.entries(catMap).map(([category, amount]) => ({ category, amount, pct: totalExpense > 0 ? (amount / totalExpense) * 100 : 0 })).sort((a, b) => b.amount - a.amount);
  const topCategory = catTotals[0];

  let status = 'EMPTY';
  if (totalIncome > 0 || totalExpense > 0) {
    if (net < 0) status = 'LOSS';
    else if (savingsRate !== null && savingsRate < 0.2) status = 'TIGHT';
    else status = 'PROFIT';
  }

  const remarks = [];
  if (status === 'EMPTY') {
    remarks.push('Add your income and expenses above to see where you stand this month.');
  } else if (status === 'LOSS') {
    remarks.push(`You spent ${formatCurrency(Math.abs(net), currency)} more than you earned this month.`);
    if (topCategory) remarks.push(CATEGORY_TIPS[topCategory.category] || CATEGORY_TIPS.Other);
    remarks.push(GENERIC_TIPS[0]);
    remarks.push(GENERIC_TIPS[1]);
  } else if (status === 'TIGHT') {
    remarks.push(`You're in profit, but only saving ${Math.round(savingsRate * 100)}% of what comes in.`);
    if (topCategory) remarks.push(CATEGORY_TIPS[topCategory.category] || CATEGORY_TIPS.Other);
    remarks.push(GENERIC_TIPS[2]);
  } else {
    remarks.push(`Solid month — you saved ${Math.round(savingsRate * 100)}% of your income.`);
    remarks.push(GENERIC_TIPS[3]);
  }

  const histMonths = Object.keys(history).sort().slice(-6);
  const maxAbs = Math.max(1, ...histMonths.map(m => Math.abs(history[m]?.net || 0)));

  const rowNo = (i) => String(i + 1).padStart(2, '0');

  function handleClearClick() {
    if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); return; }
    setIncome(emptyIncome());
    setExpenses(emptyExpenses());
    setConfirmClear(false);
  }

  return (
    <div className="min-h-screen w-full flex justify-center py-8 px-4 md:py-12" style={{ background: 'var(--paper)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap');
        .ml-app {
          --paper: #FFFFFF;
          --rose: #FDF1F2;
          --ink: #1A1817;
          --ink-soft: #726C69;
          --red: #C31432;
          --red-deep: #7A0C1F;
          --red-line: #E9AEB4;
          font-family: 'Inter', sans-serif;
          color: var(--ink);
          position: relative;
        }
        .ml-sheet { position: relative; padding-left: 44px; }
        .ml-sheet::before {
          content: '';
          position: absolute; left: 20px; top: 4px; bottom: 4px; width: 0;
          border-left: 3px solid var(--red);
          box-shadow: 7px 0 0 0 var(--red-line);
        }
        @media (max-width: 640px) {
          .ml-sheet { padding-left: 30px; }
          .ml-sheet::before { left: 12px; box-shadow: 5px 0 0 0 var(--red-line); }
        }
        .ml-title { font-family: 'Source Serif 4', serif; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; font-size: 26px; text-align: center; }
        .ml-sub { font-size: 13px; color: var(--ink-soft); text-align: center; margin-top: 2px; font-family: 'IBM Plex Mono', monospace; }
        .ml-navbtn { border: 1px solid var(--red-line); background: var(--paper); color: var(--red); width: 32px; height: 32px; border-radius: 999px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s; }
        .ml-navbtn:hover { background: var(--rose); }
        .ml-currency { font-family: 'IBM Plex Mono', monospace; font-size: 12px; border: 1px solid var(--red-line); border-radius: 6px; padding: 3px 6px; background: var(--paper); color: var(--ink-soft); }
        .ml-colhead { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--red-deep); border-bottom: 1px solid var(--red-line); padding-bottom: 6px; margin-bottom: 8px; display: flex; }
        .ml-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px dotted var(--red-line); }
        .ml-rowno { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink-soft); width: 20px; flex-shrink: 0; }
        .ml-input, .ml-select { font-family: 'Inter', sans-serif; font-size: 13px; border: none; background: transparent; color: var(--ink); padding: 4px 2px; width: 100%; }
        .ml-input:focus, .ml-select:focus { outline: none; border-bottom: 1px solid var(--red); }
        .ml-amount { font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-align: right; border: none; background: transparent; color: var(--ink); padding: 4px 2px; width: 90px; flex-shrink: 0; }
        .ml-amount:focus { outline: none; border-bottom: 1px solid var(--red); }
        .ml-delbtn { color: var(--red-line); background: none; border: none; cursor: pointer; flex-shrink: 0; display: flex; padding: 2px; }
        .ml-delbtn:hover { color: var(--red); }
        .ml-addline { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--red-deep); background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; margin-top: 8px; padding: 4px 0; }
        .ml-addline:hover { color: var(--red); }
        .ml-totrow { display: flex; justify-content: space-between; font-family: 'IBM Plex Mono', monospace; font-size: 13px; padding: 3px 0; }
        .ml-totrow.grand { font-weight: 600; border-top: 1px solid var(--ink); margin-top: 6px; padding-top: 8px; }
        .ml-stamp { font-family: 'Source Serif 4', serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; text-align: center; padding: 16px 28px; border: 3px double var(--ink); border-radius: 4px; transform: rotate(-3deg); display: inline-flex; flex-direction: column; gap: 2px; text-shadow: 0 0 1px currentColor; }
        .ml-stamp.loss { color: var(--red); border-color: var(--red); }
        .ml-stamp.empty { color: var(--ink-soft); border-color: var(--red-line); border-style: dashed; }
        .ml-stamp-label { font-size: 20px; }
        .ml-stamp-amt { font-family: 'IBM Plex Mono', monospace; letter-spacing: 0; font-weight: 500; font-size: 15px; }
        .ml-barlabel { font-size: 12px; color: var(--ink-soft); width: 130px; flex-shrink: 0; }
        .ml-bartrack { flex: 1; height: 8px; background: var(--rose); border-radius: 2px; overflow: hidden; }
        .ml-barfill { height: 100%; background: var(--red); }
        .ml-barpct { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--ink-soft); width: 34px; text-align: right; flex-shrink: 0; }
        .ml-remarks { border-left: 3px solid var(--red); background: var(--rose); padding: 14px 16px; border-radius: 0 8px 8px 0; }
        .ml-remarks-title { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--red-deep); margin-bottom: 8px; }
        .ml-remarks li { font-size: 13px; line-height: 1.55; margin-bottom: 6px; }
        .ml-trend { display: flex; align-items: flex-end; gap: 10px; height: 48px; justify-content: center; margin-bottom: 4px; }
        .ml-trend-bar-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .ml-trend-month { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--ink-soft); }
      `}</style>

      <div className="ml-app w-full max-w-3xl ml-sheet">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <button className="ml-navbtn" onClick={() => setMonthDate(m => shiftMonth(m, -1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <div>
              <h1 className="ml-title">Monthly Ledger</h1>
              <p className="ml-sub">{monthLabel(monthDate)}</p>
            </div>
            <button className="ml-navbtn" onClick={() => setMonthDate(m => shiftMonth(m, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
          <div className="flex justify-center mt-3">
            <select className="ml-currency" value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
              <option value="GBP">£ GBP</option>
            </select>
          </div>
        </header>

        {histMonths.length > 1 && (
          <div className="mb-8">
            <div className="ml-trend">
              {histMonths.map(m => {
                const netVal = history[m]?.net || 0;
                const h = Math.max(4, (Math.abs(netVal) / maxAbs) * 36);
                return (
                  <div className="ml-trend-bar-wrap" key={m} title={`${monthLabel(m)}: ${formatCurrency(netVal, currency)}`}>
                    <div style={{ height: h + 'px', width: '16px', background: netVal < 0 ? 'var(--red)' : 'var(--ink)', opacity: m === monthDate ? 1 : 0.5, borderRadius: '2px' }} />
                    <span className="ml-trend-month">{monthLabel(m).slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8 mb-6">
          <div>
            <div className="ml-colhead"><span style={{ width: 20 }}>No.</span><span className="flex-1">Money in</span><span>Amt</span></div>
            {income.map((row, i) => (
              <div className="ml-row" key={row.id}>
                <span className="ml-rowno">{rowNo(i)}</span>
                <input className="ml-input" placeholder="e.g. Salary, freelance work" value={row.label} onChange={e => updateIncome(row.id, 'label', e.target.value)} />
                <input className="ml-amount" type="number" inputMode="decimal" min="0" placeholder="0" value={row.amount} onChange={e => updateIncome(row.id, 'amount', e.target.value)} />
                <button className="ml-delbtn" onClick={() => removeIncome(row.id)} aria-label="Remove income line"><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="ml-addline" onClick={addIncome}><Plus size={13} /> Add income line</button>
          </div>

          <div className="md:border-l md:pl-8" style={{ borderColor: 'var(--red-line)' }}>
            <div className="ml-colhead"><span style={{ width: 20 }}>No.</span><span className="flex-1">Money out</span><span>Amt</span></div>
            {expenses.map((row, i) => (
              <div className="ml-row" key={row.id}>
                <span className="ml-rowno">{rowNo(i)}</span>
                <select className="ml-select" value={row.category} onChange={e => updateExpense(row.id, 'category', e.target.value)}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className="ml-amount" type="number" inputMode="decimal" min="0" placeholder="0" value={row.amount} onChange={e => updateExpense(row.id, 'amount', e.target.value)} />
                <button className="ml-delbtn" onClick={() => removeExpense(row.id)} aria-label="Remove expense line"><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="ml-addline" onClick={addExpense}><Plus size={13} /> Add expense line</button>
          </div>
        </div>

        <div className="max-w-xs mx-auto mb-8">
          <div className="ml-totrow"><span>Total in</span><span>{formatCurrency(totalIncome, currency)}</span></div>
          <div className="ml-totrow"><span>Total out</span><span>{formatCurrency(totalExpense, currency)}</span></div>
          <div className="ml-totrow grand"><span>Net</span><span style={{ color: net < 0 ? 'var(--red)' : 'var(--ink)' }}>{formatCurrency(net, currency)}</span></div>
        </div>

        <div className="flex justify-center mb-8">
          <div className={`ml-stamp ${status === 'LOSS' ? 'loss' : status === 'EMPTY' ? 'empty' : ''}`}>
            <span className="ml-stamp-label">{status === 'LOSS' ? 'Loss' : status === 'TIGHT' ? 'Thin profit' : status === 'EMPTY' ? 'No entries' : 'Profit'}</span>
            {status !== 'EMPTY' && <span className="ml-stamp-amt">{formatCurrency(Math.abs(net), currency)}</span>}
          </div>
        </div>

        {catTotals.length > 0 && (
          <div className="mb-8">
            <div className="ml-colhead" style={{ border: 'none', marginBottom: 10 }}>Where it went</div>
            <div className="flex flex-col gap-2">
              {catTotals.map(c => (
                <div className="flex items-center gap-3" key={c.category}>
                  <span className="ml-barlabel">{c.category}</span>
                  <div className="ml-bartrack"><div className="ml-barfill" style={{ width: c.pct + '%' }} /></div>
                  <span className="ml-barpct">{Math.round(c.pct)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ml-remarks mb-6">
          <div className="ml-remarks-title">Remarks</div>
          <ul style={{ paddingLeft: '18px', margin: 0 }}>
            {remarks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: 'var(--ink-soft)' }}>
          <span>{justSaved ? 'Saved' : storageError ? "Couldn't save — changes may not persist" : 'Entries save automatically, privately, per month'}</span>
          <button onClick={handleClearClick} style={{ background: 'none', border: 'none', color: confirmClear ? 'var(--red)' : 'var(--ink-soft)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
            {confirmClear ? 'Click again to clear' : 'Clear this month'}
          </button>
        </div>
      </div>
    </div>
  );
}
