"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApplicationWithCounts } from "@/types";
import { Plus, RefreshCw, Mail, Search, LayoutList, Columns3, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { DateFilter, DateRange } from "@/components/dashboard/DateFilter";

interface Props {
  applications: ApplicationWithCounts[];
  view: "table" | "kanban";
  onViewChange: (v: "table" | "kanban") => void;
  search: string;
  onSearchChange: (s: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (r: DateRange) => void;
  onAddClick: () => void;
  onSyncDone: () => void;
  gmailConnected: boolean;
}

export function Header({
  applications,
  view,
  onViewChange,
  search,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  onAddClick,
  onSyncDone,
  gmailConnected,
}: Props) {
  const [syncing, setSyncing] = useState(false);

  function handleExport() {
    if (applications.length === 0) {
      toast.error("No applications to export");
      return;
    }

    const headers = ["Company", "Role", "Status", "Applied Date", "Follow-up Date", "Source", "Job URL", "Contacts", "Notes"];

    const escape = (v: string | null | undefined) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    };

    const rows = applications.map((a) => [
      escape(a.company),
      escape(a.role),
      escape(a.status),
      escape(a.appliedDate ? format(parseISO(a.appliedDate), "yyyy-MM-dd") : ""),
      escape(a.followUpDate ? format(parseISO(a.followUpDate), "yyyy-MM-dd") : ""),
      escape(a.source),
      escape(a.jobUrl),
      escape(String(a._count.contacts)),
      escape(a.notes),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `job-applications-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${applications.length} application${applications.length !== 1 ? "s" : ""}`);
  }

  const total = applications.length;
  const active = applications.filter((a) => !["Rejected", "Withdrawn"].includes(a.status)).length;
  const interviews = applications.filter((a) => a.status === "Interview").length;
  const offers = applications.filter((a) => a.status === "Offer").length;

  async function handleSync() {
    if (!gmailConnected) {
      window.location.href = "/api/auth/google";
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? "Sync failed";
        // Token revoked or expired — clear local state and reconnect
        if (res.status === 401 && msg.includes("reconnect")) {
          toast.error("Gmail connection expired — reconnecting…");
          setTimeout(() => { window.location.href = "/api/auth/google"; }, 1500);
          return;
        }
        throw new Error(msg);
      }
      toast.success(
        `Gmail sync complete: ${data.updated} updated, ${data.created} created, ${data.skipped} skipped`
      );
      onSyncDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      if (msg.includes("not connected")) {
        toast.info("Connecting Gmail…");
        window.location.href = "/api/auth/google";
      } else {
        toast.error(msg);
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="border-b bg-background sticky top-0 z-10">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Row 1: title + view toggle */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Job Search</h1>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => onViewChange("table")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors",
                  view === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <LayoutList className="h-3.5 w-3.5" /> Table
              </button>
              <button
                onClick={() => onViewChange("kanban")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-l",
                  view === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <Columns3 className="h-3.5 w-3.5" /> Kanban
              </button>
            </div>
            <UserMenu />
          </div>
        </div>

        {/* Row 2: stats */}
        <div className="flex gap-6 text-sm">
          <Stat label="Total" value={total} />
          <Stat label="Active" value={active} />
          <Stat label="Interviews" value={interviews} accent="amber" />
          <Stat label="Offers" value={offers} accent="green" />
        </div>

        {/* Row 3: search + filters + action buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search company or role…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8"
            />
          </div>
          <DateFilter value={dateRange} onChange={onDateRangeChange} />
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={handleExport} disabled={applications.length === 0}>
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-1.5" />
              )}
              {gmailConnected ? "Sync Gmail" : "Connect Gmail"}
            </Button>
            <Button onClick={onAddClick}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Application
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "amber" | "green" }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={cn(
          "text-xl font-bold",
          accent === "amber" && "text-amber-600",
          accent === "green" && "text-green-600"
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
