export const STATUSES = [
  "Applied",
  "Networking",
  "Phone Screen",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
] as const;

export type Status = (typeof STATUSES)[number];

export const STATUS_COLORS: Record<Status, string> = {
  Applied: "bg-blue-100 text-blue-800",
  Networking: "bg-purple-100 text-purple-800",
  "Phone Screen": "bg-amber-100 text-amber-800",
  Interview: "bg-amber-100 text-amber-800",
  Offer: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Withdrawn: "bg-gray-100 text-gray-800",
};

// Status order for forward-only progression
export const STATUS_ORDER: Record<Status, number> = {
  Applied: 0,
  Networking: 1,
  "Phone Screen": 2,
  Interview: 3,
  Offer: 4,
  Rejected: 5,
  Withdrawn: 6,
};

export const PLATFORMS = ["linkedin", "email", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface ApplicationWithCounts {
  id: string;
  company: string;
  role: string;
  jobUrl: string | null;
  status: Status;
  appliedDate: string;
  followUpDate: string | null;
  notes: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  _count: { contacts: number };
}

export interface ContactType {
  id: string;
  applicationId: string;
  name: string;
  role: string | null;
  platform: Platform;
  outreachDate: string;
  notes: string | null;
  createdAt: string;
}

export interface TimelineEntry {
  id: string;
  applicationId: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export interface ApplicationDetail extends ApplicationWithCounts {
  contacts: ContactType[];
  timeline: TimelineEntry[];
}
