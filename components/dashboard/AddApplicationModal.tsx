"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUSES } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AddApplicationModal({ open, onClose, onCreated }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");

  const [form, setForm] = useState({
    company: "",
    role: "",
    jobUrl: "",
    appliedDate: today,
    status: "Applied",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const update = (field: string, value: string | null) =>
    setForm((prev) => ({ ...prev, [field]: value ?? "" }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Application added!");
      setForm({ company: "", role: "", jobUrl: "", appliedDate: today, status: "Applied", notes: "" });
      onCreated();
      onClose();
    } catch {
      toast.error("Failed to add application.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Application</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="company">Company *</Label>
            <Input
              id="company"
              value={form.company}
              onChange={(e) => update("company", e.target.value)}
              placeholder="Acme Corp"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="role">Role / Job Title *</Label>
            <Input
              id="role"
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              placeholder="Senior Product Manager"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="jobUrl">Job URL</Label>
            <Input
              id="jobUrl"
              type="url"
              value={form.jobUrl}
              onChange={(e) => update("jobUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="appliedDate">Applied Date *</Label>
              <Input
                id="appliedDate"
                type="date"
                value={form.appliedDate}
                onChange={(e) => update("appliedDate", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add Application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
