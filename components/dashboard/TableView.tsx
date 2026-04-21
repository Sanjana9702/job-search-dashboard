"use client";

import { useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { ApplicationWithCounts } from "@/types";
import { format, parseISO, isToday, isPast, startOfDay } from "date-fns";
import { ArrowUpDown, ExternalLink, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = "appliedDate" | "company" | "followUpDate";

interface Props {
  applications: ApplicationWithCounts[];
  onRowClick: (id: string) => void;
  search: string;
}

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return "—"; }
}

function isOverdue(app: ApplicationWithCounts): boolean {
  if (!app.followUpDate) return false;
  if (["Rejected", "Withdrawn", "Offer"].includes(app.status)) return false;
  const d = parseISO(app.followUpDate);
  return isToday(d) || isPast(startOfDay(d));
}

export function TableView({ applications, onRowClick, search }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("appliedDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return applications.filter(
      (a) => a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)
    );
  }, [applications, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "company") {
        cmp = a.company.localeCompare(b.company);
      } else if (sortKey === "appliedDate") {
        cmp = a.appliedDate.localeCompare(b.appliedDate);
      } else if (sortKey === "followUpDate") {
        const aDate = a.followUpDate ?? "9999";
        const bDate = b.followUpDate ?? "9999";
        cmp = aDate.localeCompare(bDate);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "appliedDate" ? "desc" : "asc");
    }
  }

  function SortButton({ col }: { col: SortKey }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 gap-1 font-medium"
        onClick={() => toggleSort(col)}
      >
        {col === "appliedDate" ? "Applied Date" : col === "followUpDate" ? "Follow-up Date" : "Company"}
        <ArrowUpDown className="h-3.5 w-3.5" />
      </Button>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
        <p className="text-lg">No applications yet</p>
        <p className="text-sm">Click &quot;+ Add Application&quot; to get started</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead><SortButton col="company" /></TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead><SortButton col="appliedDate" /></TableHead>
            <TableHead><SortButton col="followUpDate" /></TableHead>
            <TableHead>Contacts</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((app) => {
            const overdue = isOverdue(app);
            return (
              <TableRow
                key={app.id}
                className={cn(
                  "cursor-pointer hover:bg-muted/50 transition-colors",
                  overdue && "border-l-4 border-l-amber-400"
                )}
                onClick={() => onRowClick(app.id)}
              >
                <TableCell className="font-medium">{app.company}</TableCell>
                <TableCell className="text-muted-foreground">{app.role}</TableCell>
                <TableCell><StatusBadge status={app.status} /></TableCell>
                <TableCell className="text-sm">{fmt(app.appliedDate)}</TableCell>
                <TableCell className={cn("text-sm", overdue && "text-amber-600 font-medium")}>
                  {fmt(app.followUpDate)}
                </TableCell>
                <TableCell>
                  {app._count.contacts > 0 ? (
                    <Badge variant="secondary" className="gap-1 cursor-pointer">
                      <Users className="h-3 w-3" />
                      {app._count.contacts}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {app.jobUrl && (
                    <a
                      href={app.jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
