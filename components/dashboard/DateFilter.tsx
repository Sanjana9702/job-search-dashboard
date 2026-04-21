"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { subDays, subMonths, subYears, startOfYear, format } from "date-fns";

export type DateRange = {
  preset: "all" | "7d" | "30d" | "3m" | "6m" | "1y" | "ytd" | "custom";
  from: Date | null;
  to: Date | null;
};

export const DEFAULT_DATE_RANGE: DateRange = { preset: "all", from: null, to: null };

const PRESETS: { value: DateRange["preset"]; label: string; range: () => { from: Date; to: Date } | null }[] = [
  { value: "all",    label: "All time",       range: () => null },
  { value: "7d",     label: "Last 7 days",    range: () => ({ from: subDays(new Date(), 7),    to: new Date() }) },
  { value: "30d",    label: "Last 30 days",   range: () => ({ from: subDays(new Date(), 30),   to: new Date() }) },
  { value: "3m",     label: "Last 3 months",  range: () => ({ from: subMonths(new Date(), 3),  to: new Date() }) },
  { value: "6m",     label: "Last 6 months",  range: () => ({ from: subMonths(new Date(), 6),  to: new Date() }) },
  { value: "1y",     label: "Last 12 months", range: () => ({ from: subYears(new Date(), 1),   to: new Date() }) },
  { value: "ytd",    label: "This year",      range: () => ({ from: startOfYear(new Date()),   to: new Date() }) },
  { value: "custom", label: "Custom range",   range: () => null },
];

function toInputVal(d: Date | null) {
  return d ? format(d, "yyyy-MM-dd") : "";
}

function labelFor(range: DateRange): string {
  if (range.preset === "all") return "All time";
  if (range.preset === "custom") {
    const f = range.from ? format(range.from, "MMM d, yyyy") : "…";
    const t = range.to   ? format(range.to,   "MMM d, yyyy") : "…";
    return `${f} – ${t}`;
  }
  return PRESETS.find((p) => p.value === range.preset)?.label ?? "All time";
}

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
}

export function DateFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(toInputVal(value.from));
  const [customTo, setCustomTo]   = useState(toInputVal(value.to));
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function selectPreset(preset: string) {
    if (preset === "custom") {
      onChange({ preset: "custom", from: value.from, to: value.to });
      return;
    }
    const p = PRESETS.find((x) => x.value === preset)!;
    const r = p.range();
    onChange({ preset: p.value, from: r?.from ?? null, to: r?.to ?? null });
    setOpen(false);
  }

  function applyCustom() {
    const from = customFrom ? new Date(customFrom) : null;
    const to   = customTo   ? new Date(customTo)   : null;
    onChange({ preset: "custom", from, to });
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    setCustomFrom("");
    setCustomTo("");
    onChange(DEFAULT_DATE_RANGE);
  }

  const isActive = value.preset !== "all";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
          isActive
            ? "border-primary bg-primary/5 text-primary"
            : "border-input bg-background hover:bg-muted text-foreground"
        )}
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <span className="max-w-[160px] truncate">{labelFor(value)}</span>
        {isActive ? (
          <X className="h-3 w-3 ml-0.5 shrink-0" onClick={clear} />
        ) : (
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-md border bg-popover shadow-md text-sm">
          <div className="p-1">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => selectPreset(p.value)}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 hover:bg-accent transition-colors",
                  value.preset === p.value && "bg-accent font-medium"
                )}
              >
                {p.label}
                {value.preset === p.value && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          {value.preset === "custom" && (
            <div className="border-t p-3 space-y-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To</label>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <button
                onClick={applyCustom}
                disabled={!customFrom && !customTo}
                className="w-full rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
