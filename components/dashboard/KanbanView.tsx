"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { StatusBadge } from "./StatusBadge";
import { ApplicationWithCounts, STATUSES, Status, STATUS_ORDER } from "@/types";
import { format, parseISO, isToday, isPast, startOfDay } from "date-fns";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  applications: ApplicationWithCounts[];
  onCardClick: (id: string) => void;
  onUpdated: () => void;
  search: string;
}

function fmt(d: string | null | undefined) {
  if (!d) return null;
  try { return format(parseISO(d), "MMM d"); } catch { return null; }
}

function isOverdue(app: ApplicationWithCounts): boolean {
  if (!app.followUpDate) return false;
  if (["Rejected", "Withdrawn", "Offer"].includes(app.status)) return false;
  const d = parseISO(app.followUpDate);
  return isToday(d) || isPast(startOfDay(d));
}

function KanbanCard({
  app,
  onClick,
}: {
  app: ApplicationWithCounts;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: app.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const overdue = isOverdue(app);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow select-none",
        isDragging && "opacity-30",
        overdue && "border-l-4 border-l-amber-400"
      )}
    >
      <p className="font-semibold text-sm leading-snug">{app.company}</p>
      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{app.role}</p>
      <div className="flex items-center justify-between mt-2 gap-2">
        <span className="text-xs text-muted-foreground">{fmt(app.appliedDate)}</span>
        {app._count.contacts > 0 && (
          <Badge variant="secondary" className="gap-1 text-xs px-1.5 py-0">
            <Users className="h-2.5 w-2.5" />
            {app._count.contacts}
          </Badge>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  apps,
  onCardClick,
}: {
  status: Status;
  apps: ApplicationWithCounts[];
  onCardClick: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  // Sort: overdue first, then by applied date desc
  const sorted = [...apps].sort((a, b) => {
    const ao = isOverdue(a) ? 0 : 1;
    const bo = isOverdue(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return b.appliedDate.localeCompare(a.appliedDate);
  });

  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-xs text-muted-foreground font-medium">{apps.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[120px] rounded-lg p-2 space-y-2 transition-colors",
          isOver ? "bg-muted/80 ring-2 ring-primary/20" : "bg-muted/30"
        )}
      >
        {sorted.map((app) => (
          <KanbanCard key={app.id} app={app} onClick={() => onCardClick(app.id)} />
        ))}
      </div>
    </div>
  );
}

export function KanbanView({ applications, onCardClick, onUpdated, search }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const filtered = search
    ? applications.filter(
        (a) =>
          a.company.toLowerCase().includes(search.toLowerCase()) ||
          a.role.toLowerCase().includes(search.toLowerCase())
      )
    : applications;

  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s, filtered.filter((a) => a.status === s)])
  ) as Record<Status, ApplicationWithCounts[]>;

  const activeApp = activeId ? applications.find((a) => a.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const app = applications.find((a) => a.id === active.id);
    if (!app) return;

    const newStatus = over.id as Status;
    const currentRank = STATUS_ORDER[app.status as Status] ?? 0;
    const newRank = STATUS_ORDER[newStatus] ?? 0;

    if (newRank <= currentRank) {
      toast.error("Status can only move forward");
      return;
    }

    try {
      const res = await fetch(`/api/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      onUpdated();
      toast.success(`Moved to ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 min-h-[60vh]">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            apps={byStatus[status] ?? []}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeApp && (
          <div className="rounded-lg border bg-card p-3 shadow-xl w-64 opacity-95">
            <p className="font-semibold text-sm">{activeApp.company}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{activeApp.role}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
