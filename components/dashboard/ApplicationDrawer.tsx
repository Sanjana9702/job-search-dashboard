"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "./StatusBadge";
import { STATUSES, PLATFORMS, ApplicationDetail, ContactType } from "@/types";
import { format, parseISO } from "date-fns";
import { Trash2, Plus, ExternalLink, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  appId: string | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  email: "Email",
  other: "Other",
};

export function ApplicationDrawer({ appId, onClose, onUpdated, onDeleted }: Props) {
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "", role: "", platform: "linkedin", outreachDate: format(new Date(), "yyyy-MM-dd"), notes: "",
  });

  // Editable fields state
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editFollowUp, setEditFollowUp] = useState("");
  const [editJobUrl, setEditJobUrl] = useState("");

  useEffect(() => {
    if (!appId) { setApp(null); return; }
    setLoading(true);
    fetch(`/api/applications/${appId}`)
      .then((r) => r.json())
      .then((data) => {
        setApp(data);
        setEditStatus(data.status);
        setEditNotes(data.notes ?? "");
        setEditFollowUp(data.followUpDate ? data.followUpDate.split("T")[0] : "");
        setEditJobUrl(data.jobUrl ?? "");
      })
      .finally(() => setLoading(false));
  }, [appId]);

  async function saveField(field: string, value: unknown) {
    if (!app) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setApp(updated);
      setEditStatus(updated.status);
      setEditNotes(updated.notes ?? "");
      setEditFollowUp(updated.followUpDate ? updated.followUpDate.split("T")[0] : "");
      setEditJobUrl(updated.jobUrl ?? "");
      onUpdated();
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!app) return;
    try {
      await fetch(`/api/applications/${app.id}`, { method: "DELETE" });
      toast.success("Application deleted");
      onDeleted();
      onClose();
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!app) return;
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: app.id, ...contactForm }),
      });
      if (!res.ok) throw new Error();
      const newContact = await res.json();
      setApp((prev) => prev ? {
        ...prev,
        contacts: [newContact, ...prev.contacts],
        _count: { contacts: prev._count.contacts + 1 },
      } : prev);
      setContactForm({ name: "", role: "", platform: "linkedin", outreachDate: format(new Date(), "yyyy-MM-dd"), notes: "" });
      setShowAddContact(false);
      onUpdated();
      toast.success("Contact added");
    } catch {
      toast.error("Failed to add contact");
    }
  }

  async function handleDeleteContact(contact: ContactType) {
    try {
      await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      setApp((prev) => prev ? {
        ...prev,
        contacts: prev.contacts.filter((c) => c.id !== contact.id),
        _count: { contacts: prev._count.contacts - 1 },
      } : prev);
      onUpdated();
      toast.success("Contact removed");
    } catch {
      toast.error("Failed to remove contact");
    }
  }

  return (
    <Sheet open={!!appId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-40 text-muted-foreground">Loading…</div>
        )}
        {!loading && app && (
          <div className="space-y-6 pb-10">
            <SheetHeader>
              <SheetTitle className="text-xl">{app.company}</SheetTitle>
              <p className="text-muted-foreground text-sm">{app.role}</p>
            </SheetHeader>

            {/* Core fields */}
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-3">
                <Label className="w-28 shrink-0 text-sm">Status</Label>
                <Select
                  value={editStatus}
                  onValueChange={(v) => { if (v) { setEditStatus(v); saveField("status", v); } }}
                  disabled={saving}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Applied date (read-only display) */}
              <div className="flex items-center gap-3">
                <Label className="w-28 shrink-0 text-sm">Applied</Label>
                <span className="text-sm">{formatDate(app.appliedDate)}</span>
              </div>

              {/* Follow-up date */}
              <div className="flex items-center gap-3">
                <Label className="w-28 shrink-0 text-sm">Follow-up</Label>
                <Input
                  type="date"
                  value={editFollowUp}
                  onChange={(e) => setEditFollowUp(e.target.value)}
                  onBlur={() => saveField("followUpDate", editFollowUp || null)}
                  className="flex-1"
                />
              </div>

              {/* Job URL */}
              <div className="flex items-center gap-3">
                <Label className="w-28 shrink-0 text-sm">Job URL</Label>
                <div className="flex flex-1 gap-2">
                  <Input
                    type="url"
                    value={editJobUrl}
                    onChange={(e) => setEditJobUrl(e.target.value)}
                    onBlur={() => saveField("jobUrl", editJobUrl || null)}
                    placeholder="https://..."
                    className="flex-1"
                  />
                  {editJobUrl && (
                    <a href={editJobUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                    </a>
                  )}
                </div>
              </div>

              {/* Source badge */}
              <div className="flex items-center gap-3">
                <Label className="w-28 shrink-0 text-sm">Source</Label>
                <StatusBadge status={app.source === "gmail_sync" ? "Gmail Sync" : "Manual"} />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-sm">Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  onBlur={() => saveField("notes", editNotes)}
                  placeholder="Add notes..."
                  rows={4}
                />
              </div>
            </div>

            {/* Contacts section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <User className="h-4 w-4" /> Contacts ({app._count.contacts})
                </h3>
                <Button variant="outline" size="sm" onClick={() => setShowAddContact((v) => !v)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Contact
                </Button>
              </div>

              {showAddContact && (
                <form onSubmit={handleAddContact} className="border rounded-lg p-4 mb-3 space-y-3 bg-muted/30">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name *</Label>
                      <Input
                        value={contactForm.name}
                        onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                        required
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Their Role</Label>
                      <Input
                        value={contactForm.role}
                        onChange={(e) => setContactForm((p) => ({ ...p, role: e.target.value }))}
                        placeholder="Recruiter"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Platform</Label>
                      <Select
                        value={contactForm.platform}
                        onValueChange={(v) => setContactForm((p) => ({ ...p, platform: v ?? p.platform }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((pl) => (
                            <SelectItem key={pl} value={pl}>{PLATFORM_LABELS[pl]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Date *</Label>
                      <Input
                        type="date"
                        value={contactForm.outreachDate}
                        onChange={(e) => setContactForm((p) => ({ ...p, outreachDate: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      value={contactForm.notes}
                      onChange={(e) => setContactForm((p) => ({ ...p, notes: e.target.value }))}
                      rows={2}
                      placeholder="Optional notes"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddContact(false)}>Cancel</Button>
                    <Button type="submit" size="sm">Save Contact</Button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {app.contacts.length === 0 && (
                  <p className="text-sm text-muted-foreground">No contacts yet.</p>
                )}
                {app.contacts.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2 p-3 rounded-lg border bg-card">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {PLATFORM_LABELS[c.platform]} · {formatDate(c.outreachDate)}
                      </p>
                      {c.notes && <p className="text-xs mt-1 text-muted-foreground">{c.notes}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteContact(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline section */}
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
                <Clock className="h-4 w-4" /> Timeline
              </h3>
              <div className="space-y-2">
                {app.timeline.map((entry, i) => (
                  <div key={entry.id} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "h-2.5 w-2.5 rounded-full mt-1 shrink-0",
                        i === app.timeline.length - 1 ? "bg-primary" : "bg-muted-foreground/40"
                      )} />
                      {i < app.timeline.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />
                      )}
                    </div>
                    <div className="pb-2">
                      <p className="text-sm font-medium">{entry.status}</p>
                      {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
                      <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete */}
            <div className="pt-2 border-t">
              {!confirmDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete Application
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-destructive">Are you sure?</span>
                  <Button variant="destructive" size="sm" onClick={handleDelete}>Yes, Delete</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
