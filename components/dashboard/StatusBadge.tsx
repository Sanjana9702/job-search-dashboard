"use client";

import { Status, STATUS_COLORS } from "@/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as Status] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", color)}>
      {status}
    </span>
  );
}
