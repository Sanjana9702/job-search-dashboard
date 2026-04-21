import { addDays } from "date-fns";
import { Status } from "@/types";

/**
 * Calculate follow-up date based on status and relevant date.
 * Returns null if status is terminal (Rejected, Offer, Withdrawn).
 */
export function calcFollowUpDate(
  status: Status,
  baseDate: Date
): Date | null {
  if (["Rejected", "Offer", "Withdrawn"].includes(status)) return null;
  if (["Phone Screen", "Interview"].includes(status))
    return addDays(baseDate, 5);
  return addDays(baseDate, 7); // Applied, Networking
}
