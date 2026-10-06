import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Calculator, FileText, BadgeIndianRupee, Receipt, Percent, Wallet,
  Landmark, RotateCcw, Info, History, Trash2,
} from "lucide-react";
import api, { describeApiError } from "@/lib/api";

/* =========================================================
   Formatting & validation helpers
   (Local to the calculator so the shared `inr()` helper used
   elsewhere in the app is left untouched.)
========================================================= */

// Indian currency formatting, e.g. ₹1,18,000.00
const formatINR = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₹0.00";
  return "₹" + new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

// Parses & validates a numeric field. Returns { value } on success or
// { error } on failure — never NaN/Infinity/undefined downstream.
function parseAmount(raw, { allowZero = true, min = 0, max, label = "Value" } = {}) {
  if (raw === "" || raw === null || raw === undefined) {
    return { error: `${label} is required.` };
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return { error: `Enter a valid number for ${label}.` };
  }
  if (!allowZero && n === 0) {
    return { error: `${label} must be greater than zero.` };
  }
  if (n < min) {
    return { error: `${label} cannot be less than ${min}.` };
  }
  if (max !== undefined && n > max) {
    return { error: `${label} cannot be more than ${max}.` };
  }
  return { value: n };
}

const historyStorageKey = "ntaxco_calculation_history";

const loadHistory = () => {
  try {
    const saved = localStorage.getItem(historyStorageKey);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveHistory = (item) => {
  try {
    const history = loadHistory();
    const updated = [item, ...history].slice(0, 20);
    localStorage.setItem(historyStorageKey, JSON.stringify(updated));
  } catch {
    // Ignore storage errors (e.g. private browsing / storage full) —
    // the calculator itself must keep working either way.
  }
};

const formatDate = (date) => {
  try {
    return new Date(date).toLocaleString("en-IN");
  } catch {
    return "";
  }
};

/* =========================================================
   Shared presentational pieces
========================================================= */

function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-destructive">{message}</p>;
}

function ToggleGroup({ options, value, onChange, testId }) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1" data-testid={testId}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === opt.value
              ? "bg-white text-royal shadow-sm border border-zinc-200"
              : "text-muted-foreground hover:text-zinc-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ResultsPanel({ rows, total, note, empty, emptyText }) {
  if (empty) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center" data-testid="calculator-empty-state">
        <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
          <Calculator className="h-5 w-5 text-zinc-400" />
        </div>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {emptyText || "Enter the details above and click Calculate to see your results here."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-royal/15 bg-royal-faint/40 p-5" data-testid="calculator-results">
      <div className="space-y-2.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-zinc-600">{row.label}</span>
            <span className={`font-medium tabular-nums ${row.muted ? "text-zinc-500" : "text-zinc-900"}`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {total && (
        <div className="mt-3 pt-3 border-t border-royal/15 flex items-center justify-between gap-4">
          <span className="font-heading font-semibold text-zinc-900">{total.label}</span>
          <span className="font-heading text-xl font-bold text-royal tabular-nums">{total.value}</span>
        </div>
      )}

      {note && (
        <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}

function CalculatorShell({ icon: Icon, title, description, children }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-royal-faint flex items-center justify-center text-royal shrink-0">
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <CardTitle className="font-heading text-lg">{title}</CardTitle>
            <CardDescription className="mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CalculatorActions({ onCalculate, onReset, loading, calculateLabel = "Calculate" }) {
  return (
    <div className="flex flex-wrap items-center gap-3 mt-5">
      <Button type="button" onClick={onCalculate} disabled={loading} className="bg-brand text-zinc-900 hover:bg-brand-hover font-semibold">
        {loading ? "Calculating…" : calculateLabel}
      </Button>
      <Button type="button" variant="outline" onClick={onReset} disabled={loading}>
        <RotateCcw className="h-4 w-4" />
        Reset
      </Button>
    </div>
  );
}

const GST_RATE_PRESETS = ["0", "0.25", "3", "5", "12", "18", "28"];

function GstRateField({ ratePreset, setRatePreset, customRate, setCustomRate, error }) {
  return (
    <div>
      <Label className="text-zinc-700">GST Rate</Label>
      <Select value={ratePreset} onValueChange={setRatePreset}>
        <SelectTrigger className="mt-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white">
          {GST_RATE_PRESETS.map((r) => (
            <SelectItem key={r} value={r}>{r}% GST</SelectItem>
          ))}
          <SelectItem value="custom">Custom rate…</SelectItem>
        </SelectContent>
      </Select>
      {ratePreset === "custom" && (
        <div className="mt-2">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Enter custom GST rate %"
            value={customRate}
            onChange={(e) => setCustomRate(e.target.value)}
          />
          <FieldError message={error} />
        </div>
      )}
    </div>
  );
}

/* =========================================================
   1. GST Calculator (exclusive / inclusive, intra / inter-state)
   Uses the existing backend endpoint POST /api/calculators/gst
========================================================= */

function GstCalculator({ onCalculated }) {
  const [mode, setMode] = useState("exclusive"); // exclusive | inclusive
  const [transactionType, setTransactionType] = useState("intra"); // intra | inter
  const [amount, setAmount] = useState("");
  const [ratePreset, setRatePreset] = useState("18");
  const [customRate, setCustomRate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  const effectiveRate = ratePreset === "custom" ? customRate : ratePreset;

  const reset = useCallback(() => {
    setAmount("");
    setRatePreset("18");
    setCustomRate("");
    setResult(null);
    setErrors({});
  }, []);

  useEffect(() => { setResult(null); }, [mode, transactionType]);

  const calculate = useCallback(async () => {
    const amountCheck = parseAmount(amount, {
      allowZero: false,
      label: mode === "inclusive" ? "Total amount (incl. GST)" : "Taxable amount",
    });
    const rateCheck = parseAmount(effectiveRate, { max: 100, label: "GST rate" });

    const nextErrors = {};
    if (amountCheck.error) nextErrors.amount = amountCheck.error;
    if (rateCheck.error) nextErrors.rate = rateCheck.error;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error(amountCheck.error || rateCheck.error);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/calculators/gst", {
        amount: amountCheck.value,
        rate: rateCheck.value,
        mode,
        interstate: transactionType === "inter",
      });

      const payload = data?.data;
      setResult(payload);

      const item = {
        id: Date.now(),
        type: "GST Calculator",
        expression: `${formatINR(payload.base_amount)} + ${payload.rate}% GST (${transactionType === "inter" ? "Inter-state" : "Intra-state"})`,
        result: payload.final_amount,
        createdAt: new Date().toISOString(),
      };
      saveHistory(item);
      onCalculated?.(item);
    } catch (e) {
      const msg = describeApiError(e, "Could not calculate GST right now. Please try again.");
      setErrors({ form: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [amount, effectiveRate, mode, transactionType, onCalculated]);

  const rows = result
    ? [
        { label: "Taxable Amount", value: formatINR(result.base_amount) },
        ...(transactionType === "inter"
          ? [{ label: "IGST", value: formatINR(result.igst) }]
          : [
              { label: "CGST", value: formatINR(result.cgst) },
              { label: "SGST", value: formatINR(result.sgst) },
            ]),
        { label: "Total GST", value: formatINR(result.gst_amount), muted: true },
      ]
    : [];

  return (
    <CalculatorShell
      icon={FileText}
      title="GST Calculator"
      description="Calculate CGST, SGST and IGST — GST-exclusive or GST-inclusive."
    >
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <ToggleGroup
          value={mode}
          onChange={setMode}
          testId="gst-mode-toggle"
          options={[
            { value: "exclusive", label: "Add GST" },
            { value: "inclusive", label: "Amount Includes GST" },
          ]}
        />
        <ToggleGroup
          value={transactionType}
          onChange={setTransactionType}
          testId="gst-transaction-toggle"
          options={[
            { value: "intra", label: "Intra-state (CGST + SGST)" },
            { value: "inter", label: "Inter-state (IGST)" },
          ]}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-zinc-700">
            {mode === "inclusive" ? "Total Amount (incl. GST)" : "Taxable Amount"}
          </Label>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
            <Input
              type="number"
              inputMode="decimal"
              className="pl-7"
              placeholder="e.g. 10000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="gst-amount-input"
            />
          </div>
          <FieldError message={errors.amount} />
        </div>

        <GstRateField
          ratePreset={ratePreset}
          setRatePreset={setRatePreset}
          customRate={customRate}
          setCustomRate={setCustomRate}
          error={errors.rate}
        />
      </div>

      <CalculatorActions onCalculate={calculate} onReset={reset} loading={loading} calculateLabel="Calculate GST" />

      <ResultsPanel
        empty={!result}
        emptyText="Enter the amount and GST rate above to see the CGST/SGST/IGST split."
        rows={rows}
        total={result ? { label: "Total Amount", value: formatINR(result.final_amount) } : null}
        note={
          result
            ? "This is an estimate for informational purposes only and is not an official GST filing computation."
            : null
        }
      />
    </CalculatorShell>
  );
}

/* =========================================================
   2. Income Tax Calculator (Old / New regime)
   Uses the existing backend endpoint POST /api/calculators/income-tax
========================================================= */

function IncomeTaxCalculator({ onCalculated }) {
  const [regime, setRegime] = useState("new");
  const [annualIncome, setAnnualIncome] = useState("");
  const [otherIncome, setOtherIncome] = useState("");
  const [deductions, setDeductions] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  const reset = useCallback(() => {
    setAnnualIncome("");
    setOtherIncome("");
    setDeductions("");
    setResult(null);
    setErrors({});
  }, []);

  const calculate = useCallback(async () => {
    const incomeCheck = parseAmount(annualIncome, { allowZero: false, label: "Annual income" });
    const otherCheck = parseAmount(otherIncome || "0", { label: "Other income" });
    const deductionsCheck = parseAmount(deductions || "0", { label: "Deductions" });

    const nextErrors = {};
    if (incomeCheck.error) nextErrors.annualIncome = incomeCheck.error;
    if (otherCheck.error) nextErrors.otherIncome = otherCheck.error;
    if (deductionsCheck.error) nextErrors.deductions = deductionsCheck.error;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error(incomeCheck.error || otherCheck.error || deductionsCheck.error);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/calculators/income-tax", {
        annual_income: incomeCheck.value,
        other_income: otherCheck.value,
        deductions: deductionsCheck.value,
        regime,
      });

      const payload = data?.data;
      setResult(payload);

      const item = {
        id: Date.now(),
        type: "Income Tax Calculator",
        expression: `Taxable income ${formatINR(payload.taxable_income)} (${regime === "old" ? "Old" : "New"} Regime)`,
        result: payload.estimated_tax,
        createdAt: new Date().toISOString(),
      };
      saveHistory(item);
      onCalculated?.(item);
    } catch (e) {
      const msg = describeApiError(e, "Could not calculate income tax right now. Please try again.");
      setErrors({ form: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [annualIncome, otherIncome, deductions, regime, onCalculated]);

  const rows = result
    ? [
        { label: "Gross Income", value: formatINR(result.gross_income) },
        { label: "Deductions", value: `− ${formatINR(result.deductions)}`, muted: true },
        { label: "Taxable Income", value: formatINR(result.taxable_income) },
        { label: "Income Tax", value: formatINR(result.income_tax) },
        { label: "Health & Education Cess (4%)", value: formatINR(result.cess), muted: true },
      ]
    : [];

  return (
    <CalculatorShell
      icon={BadgeIndianRupee}
      title="Income Tax Calculator"
      description="Estimate your income tax liability under the old or new tax regime."
    >
      <div className="mb-5">
        <ToggleGroup
          value={regime}
          onChange={setRegime}
          testId="income-tax-regime-toggle"
          options={[
            { value: "new", label: "New Regime" },
            { value: "old", label: "Old Regime" },
          ]}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-zinc-700">Annual Income (Salary)</Label>
          <Input
            type="number"
            inputMode="decimal"
            className="mt-1.5"
            placeholder="e.g. 1200000"
            value={annualIncome}
            onChange={(e) => setAnnualIncome(e.target.value)}
            data-testid="itc-annual-income-input"
          />
          <FieldError message={errors.annualIncome} />
        </div>
        <div>
          <Label className="text-zinc-700">Other Income</Label>
          <Input
            type="number"
            inputMode="decimal"
            className="mt-1.5"
            placeholder="e.g. 0"
            value={otherIncome}
            onChange={(e) => setOtherIncome(e.target.value)}
          />
          <FieldError message={errors.otherIncome} />
        </div>
        <div>
          <Label className="text-zinc-700">Deductions</Label>
          <Input
            type="number"
            inputMode="decimal"
            className="mt-1.5"
            placeholder="e.g. 150000"
            value={deductions}
            onChange={(e) => setDeductions(e.target.value)}
          />
          <FieldError message={errors.deductions} />
        </div>
      </div>

      <CalculatorActions onCalculate={calculate} onReset={reset} loading={loading} calculateLabel="Estimate Tax" />

      <ResultsPanel
        empty={!result}
        emptyText="Enter your income details above to see an estimated tax breakup."
        rows={rows}
        total={result ? { label: "Estimated Tax Payable", value: formatINR(result.estimated_tax) } : null}
        note={
          result
            ? `Estimated for Assessment Year ${result.assessment_year} under the ${regime === "old" ? "Old" : "New"} Tax Regime. This is an approximate planning estimate only — it does not account for every deduction, rebate or surcharge and is not an official return or tax filing.`
            : null
        }
      />
    </CalculatorShell>
  );
}

/* =========================================================
   3. Advance Tax Calculator (frontend-only estimate,
      derived from the customer's own inputs — CBDT schedule)
========================================================= */

const ADVANCE_TAX_SCHEDULE = [
  { label: "On or before 15 June", pct: 0.15 },
  { label: "On or before 15 September", pct: 0.45 },
  { label: "On or before 15 December", pct: 0.75 },
  { label: "On or before 15 March", pct: 1.0 },
];

function AdvanceTaxCalculator({ onCalculated }) {
  const [liability, setLiability] = useState("");
  const [alreadyPaid, setAlreadyPaid] = useState("");
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  const reset = useCallback(() => {
    setLiability("");
    setAlreadyPaid("");
    setResult(null);
    setErrors({});
  }, []);

  const calculate = useCallback(() => {
    const liabilityCheck = parseAmount(liability, { allowZero: false, label: "Estimated annual tax liability" });
    const paidCheck = parseAmount(alreadyPaid || "0", { label: "Tax already paid" });

    const nextErrors = {};
    if (liabilityCheck.error) nextErrors.liability = liabilityCheck.error;
    if (paidCheck.error) nextErrors.alreadyPaid = paidCheck.error;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error(liabilityCheck.error || paidCheck.error);
      return;
    }

    const fullLiability = liabilityCheck.value;
    const paid = Math.min(paidCheck.value, fullLiability);
    const balance = Math.max(0, fullLiability - paid);

    const installments = ADVANCE_TAX_SCHEDULE.map((s) => ({
      ...s,
      cumulativeTarget: s.pct * fullLiability,
      payableByDate: Math.max(0, s.pct * fullLiability - paid),
    }));

    const payload = { fullLiability, paid, balance, installments, exempt: balance <= 10000 };
    setResult(payload);

    const item = {
      id: Date.now(),
      type: "Advance Tax Calculator",
      expression: `Liability ${formatINR(fullLiability)}, already paid ${formatINR(paid)}`,
      result: balance,
      createdAt: new Date().toISOString(),
    };
    saveHistory(item);
    onCalculated?.(item);
  }, [liability, alreadyPaid, onCalculated]);

  const rows = result
    ? result.exempt
      ? []
      : result.installments.map((row) => ({
          label: `${row.label} (${Math.round(row.pct * 100)}% cumulative)`,
          value: formatINR(row.payableByDate),
        }))
    : [];

  return (
    <CalculatorShell
      icon={Landmark}
      title="Advance Tax Calculator"
      description="Estimate your quarterly advance tax instalments from your expected annual tax liability."
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-zinc-700">Estimated Annual Tax Liability</Label>
          <Input
            type="number"
            inputMode="decimal"
            className="mt-1.5"
            placeholder="e.g. 120000"
            value={liability}
            onChange={(e) => setLiability(e.target.value)}
            data-testid="advance-tax-liability-input"
          />
          <FieldError message={errors.liability} />
        </div>
        <div>
          <Label className="text-zinc-700">Tax Already Paid (TDS / Advance Tax)</Label>
          <Input
            type="number"
            inputMode="decimal"
            className="mt-1.5"
            placeholder="e.g. 0"
            value={alreadyPaid}
            onChange={(e) => setAlreadyPaid(e.target.value)}
          />
          <FieldError message={errors.alreadyPaid} />
        </div>
      </div>

      <CalculatorActions onCalculate={calculate} onReset={reset} loading={false} calculateLabel="Estimate Instalments" />

      {result?.exempt ? (
        <div className="mt-6 rounded-lg border border-royal/15 bg-royal-faint/40 p-5 text-sm text-zinc-700">
          Your balance tax liability of {formatINR(result.balance)} is at or below the ₹10,000 threshold under
          Section 208 of the Income Tax Act — advance tax is generally not required in this case.
        </div>
      ) : (
        <ResultsPanel
          empty={!result}
          emptyText="Enter your expected annual tax liability above to see the instalment schedule."
          rows={rows}
          total={result ? { label: "Balance Tax Payable", value: formatINR(result.balance) } : null}
          note={
            result
              ? "Simplified estimate assuming tax already paid is adjusted against the earliest instalment. Actual due dates, thresholds and interest under Sections 234B/234C depend on your full tax position — consult your tax advisor for exact figures."
              : null
          }
        />
      )}
    </CalculatorShell>
  );
}

/* =========================================================
   4. TDS Calculator (frontend-only, configurable category rates)
========================================================= */

const TDS_CATEGORIES = [
  { id: "194c_ind", label: "Contractor Payment — Individual/HUF (Sec 194C)", rate: 1 },
  { id: "194c_other", label: "Contractor Payment — Company/Firm (Sec 194C)", rate: 2 },
  { id: "194j", label: "Professional / Technical Fees (Sec 194J)", rate: 10 },
  { id: "194h", label: "Commission / Brokerage (Sec 194H)", rate: 5 },
  { id: "194i_land", label: "Rent — Land, Building or Furniture (Sec 194-I)", rate: 10 },
  { id: "194i_plant", label: "Rent — Plant or Machinery (Sec 194-I)", rate: 2 },
  { id: "194q", label: "Purchase of Goods (Sec 194Q)", rate: 0.1 },
  { id: "194a", label: "Interest — Other than Securities (Sec 194A)", rate: 10 },
  { id: "custom", label: "Custom Rate", rate: "" },
];

function TdsCalculator({ onCalculated }) {
  const [category, setCategory] = useState("194j");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState(String(TDS_CATEGORIES.find((c) => c.id === "194j").rate));
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  const handleCategoryChange = (value) => {
    setCategory(value);
    const preset = TDS_CATEGORIES.find((c) => c.id === value);
    setRate(preset && preset.rate !== "" ? String(preset.rate) : "");
    setResult(null);
  };

  const reset = useCallback(() => {
    setCategory("194j");
    setAmount("");
    setRate(String(TDS_CATEGORIES.find((c) => c.id === "194j").rate));
    setResult(null);
    setErrors({});
  }, []);

  const calculate = useCallback(() => {
    const amountCheck = parseAmount(amount, { allowZero: false, label: "Gross amount" });
    const rateCheck = parseAmount(rate, { max: 100, label: "TDS rate" });

    const nextErrors = {};
    if (amountCheck.error) nextErrors.amount = amountCheck.error;
    if (rateCheck.error) nextErrors.rate = rateCheck.error;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error(amountCheck.error || rateCheck.error);
      return;
    }

    const gross = amountCheck.value;
    const tds = Math.round(((gross * rateCheck.value) / 100) * 100) / 100;
    const net = Math.round((gross - tds) * 100) / 100;

    const payload = { gross, tds, net, rate: rateCheck.value };
    setResult(payload);

    const item = {
      id: Date.now(),
      type: "TDS Calculator",
      expression: `${formatINR(gross)} × ${rateCheck.value}% TDS`,
      result: tds,
      createdAt: new Date().toISOString(),
    };
    saveHistory(item);
    onCalculated?.(item);
  }, [amount, rate, onCalculated]);

  return (
    <CalculatorShell
      icon={Receipt}
      title="TDS Calculator"
      description="Estimate the TDS deduction and net payable amount for a payment."
    >
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <Label className="text-zinc-700">Payment Category</Label>
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {TDS_CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-zinc-700">TDS Rate %</Label>
          <Input
            type="number"
            inputMode="decimal"
            className="mt-1.5"
            placeholder="e.g. 10"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <FieldError message={errors.rate} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <div>
          <Label className="text-zinc-700">Gross Amount</Label>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
            <Input
              type="number"
              inputMode="decimal"
              className="pl-7"
              placeholder="e.g. 50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="tds-amount-input"
            />
          </div>
          <FieldError message={errors.amount} />
        </div>
      </div>

      <CalculatorActions onCalculate={calculate} onReset={reset} loading={false} calculateLabel="Calculate TDS" />

      <ResultsPanel
        empty={!result}
        emptyText="Choose a payment category, enter the amount and click Calculate."
        rows={
          result
            ? [
                { label: "Gross Amount", value: formatINR(result.gross) },
                { label: "TDS Deducted", value: `− ${formatINR(result.tds)}`, muted: true },
              ]
            : []
        }
        total={result ? { label: "Net Payable Amount", value: formatINR(result.net) } : null}
        note={
          result
            ? "General reference rates under the Income Tax Act. The actual applicable rate depends on the payee's category, PAN availability and prescribed thresholds — confirm with your tax consultant before deduction."
            : null
        }
      />
    </CalculatorShell>
  );
}

/* =========================================================
   5. Invoice / Amount Calculator
   Reuses the same backend GST logic as the GST Calculator
   (POST /api/calculators/gst) for the tax component.
========================================================= */

function InvoiceCalculator({ onCalculated }) {
  const [rate, setRate] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [discount, setDiscount] = useState("0");
  const [transactionType, setTransactionType] = useState("intra");
  const [ratePreset, setRatePreset] = useState("18");
  const [customRate, setCustomRate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  const effectiveGstRate = ratePreset === "custom" ? customRate : ratePreset;

  const reset = useCallback(() => {
    setRate("");
    setQuantity("1");
    setDiscount("0");
    setRatePreset("18");
    setCustomRate("");
    setResult(null);
    setErrors({});
  }, []);

  const calculate = useCallback(async () => {
    const rateCheck = parseAmount(rate, { allowZero: false, label: "Item amount" });
    const qtyCheck = parseAmount(quantity, { allowZero: false, label: "Quantity" });
    const discountCheck = parseAmount(discount || "0", { max: 100, label: "Discount %" });
    const gstCheck = parseAmount(effectiveGstRate, { max: 100, label: "GST rate" });

    const nextErrors = {};
    if (rateCheck.error) nextErrors.rate = rateCheck.error;
    if (qtyCheck.error) nextErrors.quantity = qtyCheck.error;
    if (discountCheck.error) nextErrors.discount = discountCheck.error;
    if (gstCheck.error) nextErrors.gstRate = gstCheck.error;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error(rateCheck.error || qtyCheck.error || discountCheck.error || gstCheck.error);
      return;
    }

    const gross = Math.round(rateCheck.value * qtyCheck.value * 100) / 100;
    const discountAmt = Math.round(((gross * discountCheck.value) / 100) * 100) / 100;
    const taxable = Math.round((gross - discountAmt) * 100) / 100;

    setLoading(true);
    try {
      const { data } = await api.post("/calculators/gst", {
        amount: taxable,
        rate: gstCheck.value,
        mode: "exclusive",
        interstate: transactionType === "inter",
      });

      const payload = { ...data?.data, gross, discountAmt, taxable };
      setResult(payload);

      const item = {
        id: Date.now(),
        type: "Invoice Calculator",
        expression: `${qtyCheck.value} × ${formatINR(rateCheck.value)} − ${discountCheck.value}% + ${gstCheck.value}% GST`,
        result: payload.final_amount,
        createdAt: new Date().toISOString(),
      };
      saveHistory(item);
      onCalculated?.(item);
    } catch (e) {
      const msg = describeApiError(e, "Could not calculate the invoice total right now. Please try again.");
      setErrors({ form: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [rate, quantity, discount, effectiveGstRate, transactionType, onCalculated]);

  const rows = result
    ? [
        { label: "Item Amount × Quantity", value: formatINR(result.gross) },
        { label: "Discount", value: `− ${formatINR(result.discountAmt)}`, muted: true },
        { label: "Taxable Amount", value: formatINR(result.taxable) },
        ...(transactionType === "inter"
          ? [{ label: "IGST", value: formatINR(result.igst) }]
          : [
              { label: "CGST", value: formatINR(result.cgst) },
              { label: "SGST", value: formatINR(result.sgst) },
            ]),
      ]
    : [];

  return (
    <CalculatorShell
      icon={Wallet}
      title="Invoice / Amount Calculator"
      description="Work out an invoice total from item amount, quantity, discount and GST."
    >
      <div className="mb-5">
        <ToggleGroup
          value={transactionType}
          onChange={setTransactionType}
          testId="invoice-transaction-toggle"
          options={[
            { value: "intra", label: "Intra-state (CGST + SGST)" },
            { value: "inter", label: "Inter-state (IGST)" },
          ]}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-zinc-700">Item Amount (per unit)</Label>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
            <Input
              type="number"
              inputMode="decimal"
              className="pl-7"
              placeholder="e.g. 1000"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              data-testid="invoice-rate-input"
            />
          </div>
          <FieldError message={errors.rate} />
        </div>
        <div>
          <Label className="text-zinc-700">Quantity</Label>
          <Input
            type="number"
            inputMode="numeric"
            className="mt-1.5"
            placeholder="e.g. 1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <FieldError message={errors.quantity} />
        </div>
        <div>
          <Label className="text-zinc-700">Discount %</Label>
          <Input
            type="number"
            inputMode="decimal"
            className="mt-1.5"
            placeholder="e.g. 0"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
          <FieldError message={errors.discount} />
        </div>
        <GstRateField
          ratePreset={ratePreset}
          setRatePreset={setRatePreset}
          customRate={customRate}
          setCustomRate={setCustomRate}
          error={errors.gstRate}
        />
      </div>

      <CalculatorActions onCalculate={calculate} onReset={reset} loading={loading} calculateLabel="Calculate Total" />

      <ResultsPanel
        empty={!result}
        emptyText="Enter the item amount, quantity, discount and GST rate to see the invoice total."
        rows={rows}
        total={result ? { label: "Invoice Total", value: formatINR(result.final_amount) } : null}
        note={result ? "This is an estimate for quick reference only and does not replace an official invoice." : null}
      />
    </CalculatorShell>
  );
}

/* =========================================================
   6. Percentage / Discount Calculator (frontend-only utility)
========================================================= */

function PercentageCalculator({ onCalculated }) {
  const [mode, setMode] = useState("discount"); // discount | change
  const [amount, setAmount] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [taxPct, setTaxPct] = useState("0");
  const [direction, setDirection] = useState("increase"); // increase | decrease
  const [percent, setPercent] = useState("");
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => { setResult(null); setErrors({}); }, [mode]);

  const reset = useCallback(() => {
    setAmount(""); setDiscountPct(""); setTaxPct("0");
    setPercent(""); setDirection("increase");
    setResult(null); setErrors({});
  }, []);

  const calculateDiscount = useCallback(() => {
    const amountCheck = parseAmount(amount, { allowZero: false, label: "Amount" });
    const discountCheck = parseAmount(discountPct || "0", { max: 100, label: "Discount %" });
    const taxCheck = parseAmount(taxPct || "0", { max: 100, label: "Tax %" });

    const nextErrors = {};
    if (amountCheck.error) nextErrors.amount = amountCheck.error;
    if (discountCheck.error) nextErrors.discountPct = discountCheck.error;
    if (taxCheck.error) nextErrors.taxPct = taxCheck.error;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error(amountCheck.error || discountCheck.error || taxCheck.error);
      return;
    }

    const original = amountCheck.value;
    const discountAmt = Math.round(((original * discountCheck.value) / 100) * 100) / 100;
    const afterDiscount = Math.round((original - discountAmt) * 100) / 100;
    const taxAmt = Math.round(((afterDiscount * taxCheck.value) / 100) * 100) / 100;
    const final = Math.round((afterDiscount + taxAmt) * 100) / 100;

    const payload = { original, discountAmt, afterDiscount, taxAmt, final };
    setResult(payload);

    const item = {
      id: Date.now(),
      type: "Discount Calculator",
      expression: `${formatINR(original)} − ${discountCheck.value}% + ${taxCheck.value}% tax`,
      result: final,
      createdAt: new Date().toISOString(),
    };
    saveHistory(item);
    onCalculated?.(item);
  }, [amount, discountPct, taxPct, onCalculated]);

  const calculateChange = useCallback(() => {
    const baseCheck = parseAmount(amount, { allowZero: false, label: "Original value" });
    const percentCheck = parseAmount(percent, { label: "Percentage" });

    const nextErrors = {};
    if (baseCheck.error) nextErrors.amount = baseCheck.error;
    if (percentCheck.error) nextErrors.percent = percentCheck.error;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error(baseCheck.error || percentCheck.error);
      return;
    }

    const base = baseCheck.value;
    const changeAmt = Math.round(((base * percentCheck.value) / 100) * 100) / 100;
    const newValue = direction === "increase"
      ? Math.round((base + changeAmt) * 100) / 100
      : Math.round((base - changeAmt) * 100) / 100;

    const payload = { base, changeAmt, newValue };
    setResult(payload);

    const item = {
      id: Date.now(),
      type: "Percentage Calculator",
      expression: `${formatINR(base)} ${direction === "increase" ? "+" : "−"} ${percentCheck.value}%`,
      result: newValue,
      createdAt: new Date().toISOString(),
    };
    saveHistory(item);
    onCalculated?.(item);
  }, [amount, percent, direction, onCalculated]);

  return (
    <CalculatorShell
      icon={Percent}
      title="Percentage / Discount Calculator"
      description="Quick percentage increase, decrease, discount and tax calculations."
    >
      <div className="mb-5">
        <ToggleGroup
          value={mode}
          onChange={setMode}
          testId="percentage-mode-toggle"
          options={[
            { value: "discount", label: "Discount & Tax" },
            { value: "change", label: "Percentage Increase/Decrease" },
          ]}
        />
      </div>

      {mode === "discount" ? (
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-zinc-700">Amount</Label>
            <Input
              type="number"
              inputMode="decimal"
              className="mt-1.5"
              placeholder="e.g. 2000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="percentage-amount-input"
            />
            <FieldError message={errors.amount} />
          </div>
          <div>
            <Label className="text-zinc-700">Discount %</Label>
            <Input
              type="number"
              inputMode="decimal"
              className="mt-1.5"
              placeholder="e.g. 10"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
            />
            <FieldError message={errors.discountPct} />
          </div>
          <div>
            <Label className="text-zinc-700">Tax %</Label>
            <Input
              type="number"
              inputMode="decimal"
              className="mt-1.5"
              placeholder="e.g. 18"
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
            />
            <FieldError message={errors.taxPct} />
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-zinc-700">Original Value</Label>
            <Input
              type="number"
              inputMode="decimal"
              className="mt-1.5"
              placeholder="e.g. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="percentage-base-input"
            />
            <FieldError message={errors.amount} />
          </div>
          <div>
            <Label className="text-zinc-700">Percentage</Label>
            <Input
              type="number"
              inputMode="decimal"
              className="mt-1.5"
              placeholder="e.g. 10"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
            <FieldError message={errors.percent} />
          </div>
          <div>
            <Label className="text-zinc-700">Change</Label>
            <div className="mt-1.5">
              <ToggleGroup
                value={direction}
                onChange={setDirection}
                options={[
                  { value: "increase", label: "Increase" },
                  { value: "decrease", label: "Decrease" },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      <CalculatorActions
        onCalculate={mode === "discount" ? calculateDiscount : calculateChange}
        onReset={reset}
        loading={false}
      />

      {mode === "discount" ? (
        <ResultsPanel
          empty={!result}
          emptyText="Enter an amount and discount/tax percentages to see the final amount."
          rows={
            result
              ? [
                  { label: "Original Amount", value: formatINR(result.original) },
                  { label: "Discount Amount", value: `− ${formatINR(result.discountAmt)}`, muted: true },
                  { label: "Amount after Discount", value: formatINR(result.afterDiscount) },
                  { label: "Tax Amount", value: `+ ${formatINR(result.taxAmt)}`, muted: true },
                ]
              : []
          }
          total={result ? { label: "Final Amount", value: formatINR(result.final) } : null}
        />
      ) : (
        <ResultsPanel
          empty={!result}
          emptyText="Enter a value and percentage to see the increased/decreased amount."
          rows={
            result
              ? [
                  { label: "Original Value", value: formatINR(result.base) },
                  { label: `${direction === "increase" ? "Increase" : "Decrease"} Amount`, value: formatINR(result.changeAmt), muted: true },
                ]
              : []
          }
          total={result ? { label: "New Value", value: formatINR(result.newValue) } : null}
        />
      )}
    </CalculatorShell>
  );
}

/* =========================================================
   7. EMI Calculator (frontend-only, existing feature restyled)
========================================================= */

function EmiCalculator({ onCalculated }) {
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [months, setMonths] = useState("");
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  const reset = useCallback(() => {
    setPrincipal(""); setRate(""); setMonths("");
    setResult(null); setErrors({});
  }, []);

  const calculate = useCallback(() => {
    const principalCheck = parseAmount(principal, { allowZero: false, label: "Loan amount" });
    const rateCheck = parseAmount(rate, { label: "Annual interest rate", max: 100 });
    const monthsCheck = parseAmount(months, { allowZero: false, label: "Loan tenure (months)" });

    const nextErrors = {};
    if (principalCheck.error) nextErrors.principal = principalCheck.error;
    if (rateCheck.error) nextErrors.rate = rateCheck.error;
    if (monthsCheck.error) nextErrors.months = monthsCheck.error;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error(principalCheck.error || rateCheck.error || monthsCheck.error);
      return;
    }

    const p = principalCheck.value;
    const n = monthsCheck.value;
    const monthlyRate = rateCheck.value / 12 / 100;

    const emi = monthlyRate === 0
      ? p / n
      : (p * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);

    if (!Number.isFinite(emi)) {
      setErrors({ form: "Could not compute EMI with these values. Please check the inputs." });
      toast.error("Could not compute EMI with these values. Please check the inputs.");
      return;
    }

    const totalPayment = emi * n;
    const totalInterest = totalPayment - p;

    const payload = { emi, totalPayment, totalInterest, principal: p };
    setResult(payload);

    const item = {
      id: Date.now(),
      type: "EMI Calculator",
      expression: `Principal ${formatINR(p)}, ${rateCheck.value}% p.a., ${n} months`,
      result: emi,
      createdAt: new Date().toISOString(),
    };
    saveHistory(item);
    onCalculated?.(item);
  }, [principal, rate, months, onCalculated]);

  return (
    <CalculatorShell
      icon={Landmark}
      title="EMI Calculator"
      description="Estimate the monthly instalment for a loan."
    >
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-zinc-700">Loan Amount</Label>
          <Input
            type="number"
            inputMode="decimal"
            className="mt-1.5"
            placeholder="e.g. 500000"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            data-testid="emi-principal-input"
          />
          <FieldError message={errors.principal} />
        </div>
        <div>
          <Label className="text-zinc-700">Annual Interest Rate %</Label>
          <Input
            type="number"
            inputMode="decimal"
            className="mt-1.5"
            placeholder="e.g. 9.5"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <FieldError message={errors.rate} />
        </div>
        <div>
          <Label className="text-zinc-700">Tenure (months)</Label>
          <Input
            type="number"
            inputMode="numeric"
            className="mt-1.5"
            placeholder="e.g. 36"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
          <FieldError message={errors.months} />
        </div>
      </div>

      <CalculatorActions onCalculate={calculate} onReset={reset} loading={false} calculateLabel="Calculate EMI" />

      <ResultsPanel
        empty={!result}
        emptyText="Enter the loan amount, interest rate and tenure to see your EMI."
        rows={
          result
            ? [
                { label: "Principal", value: formatINR(result.principal) },
                { label: "Total Interest Payable", value: formatINR(result.totalInterest) },
                { label: "Total Payment", value: formatINR(result.totalPayment), muted: true },
              ]
            : []
        }
        total={result ? { label: "Monthly EMI", value: formatINR(result.emi) } : null}
      />
    </CalculatorShell>
  );
}

/* =========================================================
   8. Basic Calculator (existing keypad calculator, restyled)
========================================================= */

function NormalCalculator({ onCalculated }) {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(true);

  const input = useCallback((value) => {
    if (fresh) {
      setDisplay(value === "." ? "0." : value);
      setFresh(false);
      return;
    }
    setDisplay((prev) => {
      if (value === "." && prev.includes(".")) return prev;
      if (prev === "0" && value !== ".") return value;
      if (prev.replace("-", "").replace(".", "").length >= 15) return prev;
      return prev + value;
    });
  }, [fresh]);

  const clear = useCallback(() => {
    setDisplay("0"); setStored(null); setOp(null); setFresh(true);
  }, []);

  const back = useCallback(() => {
    setDisplay((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
  }, []);

  const calculate = useCallback((a, b, operator) => {
    switch (operator) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default: return b;
    }
  }, []);

  const choose = useCallback((operator) => {
    const current = Number(display);
    if (!Number.isFinite(current)) return;

    if (stored !== null && op) {
      const result = calculate(stored, current, op);
      if (!Number.isFinite(result)) {
        setDisplay("Error"); setStored(null); setOp(null); setFresh(true);
        return;
      }
      setDisplay(String(result)); setStored(result);
    } else {
      setStored(current);
    }
    setOp(operator); setFresh(true);
  }, [display, stored, op, calculate]);

  const equal = useCallback(() => {
    if (stored === null || !op) return;
    const current = Number(display);
    if (!Number.isFinite(current)) return;

    const result = calculate(stored, current, op);
    if (!Number.isFinite(result)) {
      setDisplay("Error"); setStored(null); setOp(null); setFresh(true);
      return;
    }

    const expression = `${stored} ${op} ${current}`;
    setDisplay(String(result)); setStored(null); setOp(null); setFresh(true);

    const item = { id: Date.now(), type: "Basic Calculator", expression, result, createdAt: new Date().toISOString() };
    saveHistory(item);
    onCalculated?.(item);
  }, [display, stored, op, calculate, onCalculated]);

  const percent = useCallback(() => {
    const current = Number(display);
    if (!Number.isFinite(current)) return;
    setDisplay(String(current / 100));
    setFresh(true);
  }, [display]);

  const press = useCallback((key) => {
    if (/^[0-9]$/.test(key) || key === ".") { input(key); return; }
    if (["+", "-", "×", "÷"].includes(key)) { choose(key); return; }
    if (key === "=") { equal(); return; }
    if (key === "%") { percent(); return; }
    if (key === "AC") { clear(); return; }
    if (key === "⌫") back();
  }, [input, choose, equal, percent, clear, back]);

  useEffect(() => {
    const onKey = (event) => {
      const keyMap = { Enter: "=", Escape: "AC", Backspace: "⌫", "/": "÷", "*": "×" };
      const key = keyMap[event.key] || event.key;
      const allowed = ["0","1","2","3","4","5","6","7","8","9",".","%","+","-","÷","×","=","AC","⌫"];
      if (!allowed.includes(key)) return;
      event.preventDefault();
      press(key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const keys = ["AC", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "="];

  return (
    <CalculatorShell icon={Calculator} title="Basic Calculator" description="A simple arithmetic calculator for quick sums.">
      <div className="max-w-xs mx-auto">
        <div
          className="rounded-lg bg-zinc-900 text-white text-right px-4 py-5 text-3xl font-heading font-semibold mb-3 truncate"
          data-testid="basic-calculator-display"
        >
          {display}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {keys.map((key) => (
            <button
              type="button"
              key={key}
              onClick={() => press(key)}
              className={`h-12 rounded-lg text-base font-semibold transition-colors ${
                ["+", "-", "×", "÷", "="].includes(key)
                  ? "bg-brand text-zinc-900 hover:bg-brand-hover"
                  : key === "AC" || key === "⌫"
                  ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  : "bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
              } ${key === "0" ? "col-span-1" : ""}`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </CalculatorShell>
  );
}

/* =========================================================
   Recent Calculations
========================================================= */

function RecentCalculations({ history, onClear }) {
  return (
    <Card className="mt-6 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-heading">Recent Calculations</CardTitle>
          </div>
          {history.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No recent calculations yet.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="shrink-0">{item.type}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">{item.expression}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-zinc-900 tabular-nums">
                    {typeof item.result === "number" ? formatINR(item.result) : String(item.result)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* =========================================================
   Category selection + Customer Calculator page
========================================================= */

const CALCULATOR_TYPES = [
  { id: "gst", label: "GST Calculator", icon: FileText, description: "CGST, SGST, IGST — exclusive or inclusive." },
  { id: "income-tax", label: "Income Tax", icon: BadgeIndianRupee, description: "Estimate tax under the old or new regime." },
  { id: "advance-tax", label: "Advance Tax", icon: Landmark, description: "Quarterly advance tax instalments." },
  { id: "tds", label: "TDS Calculator", icon: Receipt, description: "TDS deduction and net payable amount." },
  { id: "invoice", label: "Invoice / Amount", icon: Wallet, description: "Item amount, quantity, discount and GST." },
  { id: "percentage", label: "Percentage / Discount", icon: Percent, description: "Percentage, discount and tax on an amount." },
  { id: "emi", label: "EMI Calculator", icon: Landmark, description: "Estimate a monthly loan instalment." },
  { id: "normal", label: "Basic Calculator", icon: Calculator, description: "A simple arithmetic calculator." },
];

export default function CustomerCalculator() {
  const [activeType, setActiveType] = useState("gst");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleCalculated = useCallback(() => {
    setHistory(loadHistory());
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(historyStorageKey);
    } catch {
      // Ignore storage errors.
    }
    setHistory([]);
  }, []);

  const active = useMemo(
    () => CALCULATOR_TYPES.find((c) => c.id === activeType) || CALCULATOR_TYPES[0],
    [activeType]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8" data-testid="customer-calculator-page">
      <PageHeader
        title="Tax & Financial Calculators"
        breadcrumb={["Customer", "Calculator"]}
        subtitle="GST, income tax, TDS and other quick calculations — all estimates for planning purposes."
      />

      <div className="mb-6">
        <Label className="text-zinc-700 mb-1.5 block">Choose a Calculator</Label>
        <Select value={activeType} onValueChange={setActiveType}>
          <SelectTrigger className="w-full sm:w-80" data-testid="calculator-category-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white">
            {CALCULATOR_TYPES.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1.5">{active.description}</p>
      </div>

      {activeType === "gst" && <GstCalculator onCalculated={handleCalculated} />}
      {activeType === "income-tax" && <IncomeTaxCalculator onCalculated={handleCalculated} />}
      {activeType === "advance-tax" && <AdvanceTaxCalculator onCalculated={handleCalculated} />}
      {activeType === "tds" && <TdsCalculator onCalculated={handleCalculated} />}
      {activeType === "invoice" && <InvoiceCalculator onCalculated={handleCalculated} />}
      {activeType === "percentage" && <PercentageCalculator onCalculated={handleCalculated} />}
      {activeType === "emi" && <EmiCalculator onCalculated={handleCalculated} />}
      {activeType === "normal" && <NormalCalculator onCalculated={handleCalculated} />}

      <RecentCalculations history={history} onClear={clearHistory} />
    </div>
  );
}
