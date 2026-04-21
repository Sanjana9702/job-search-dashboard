"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/Header";
import { TableView } from "@/components/dashboard/TableView";
import { KanbanView } from "@/components/dashboard/KanbanView";
import { ApplicationDrawer } from "@/components/dashboard/ApplicationDrawer";
import { AddApplicationModal } from "@/components/dashboard/AddApplicationModal";
import { ApplicationWithCounts } from "@/types";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DateRange, DEFAULT_DATE_RANGE } from "@/components/dashboard/DateFilter";
import { parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";

function Dashboard() {
  const searchParams = useSearchParams();
  const { status } = useSession();
  const router = useRouter();

  // Redirect unauthenticated users to sign-in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
    }
  }, [status, router]);

  const [applications, setApplications] = useState<ApplicationWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "kanban">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("dashboard-view") as "table" | "kanban") ?? "table";
    }
    return "table";
  });
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  // Handle OAuth redirect messages
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "gmail") {
      toast.success("Gmail connected! You can now sync.");
      setGmailConnected(true);
      window.history.replaceState({}, "", "/");
    }
    if (error === "oauth_failed") {
      toast.error("Gmail connection failed. Please try again.");
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams]);

  const fetchApplications = useCallback(async () => {
    try {
      const res = await fetch("/api/applications");
      const data = await res.json();
      // Guard: only set state if response is a valid array
      if (Array.isArray(data)) {
        setApplications(data);
      } else {
        console.error("Unexpected /api/applications response:", data);
        toast.error("Failed to load applications");
      }
    } catch {
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Check if Gmail token exists by calling the GET auth check endpoint
  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => setGmailConnected(!!d.connected))
      .catch(() => {});
  }, []);

  // Apply date filter client-side
  const filteredApplications = applications.filter((a) => {
    if (!dateRange.from && !dateRange.to) return true;
    const applied = parseISO(a.appliedDate);
    if (dateRange.from && isBefore(applied, startOfDay(dateRange.from))) return false;
    if (dateRange.to   && isAfter(applied,  endOfDay(dateRange.to)))   return false;
    return true;
  });

  function handleViewChange(v: "table" | "kanban") {
    setView(v);
    localStorage.setItem("dashboard-view", v);
  }

  // Show a minimal loading state while checking auth
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="min-h-screen bg-background">
      <Header
        applications={filteredApplications}
        view={view}
        onViewChange={handleViewChange}
        search={search}
        onSearchChange={setSearch}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onAddClick={() => setShowAddModal(true)}
        onSyncDone={fetchApplications}
        gmailConnected={gmailConnected}
      />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            Loading…
          </div>
        ) : view === "table" ? (
          <TableView
            applications={filteredApplications}
            onRowClick={setSelectedId}
            search={search}
          />
        ) : (
          <KanbanView
            applications={filteredApplications}
            onCardClick={setSelectedId}
            onUpdated={fetchApplications}
            search={search}
          />
        )}
      </main>

      <ApplicationDrawer
        appId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={fetchApplications}
        onDeleted={fetchApplications}
      />

      <AddApplicationModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={fetchApplications}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
