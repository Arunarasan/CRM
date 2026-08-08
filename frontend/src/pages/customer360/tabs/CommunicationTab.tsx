import { useState } from "react";
import { MessageSquare, Phone, Mail, Users, Building2, MapPin, Video, StickyNote, Paperclip, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import EmptyState from "../components/EmptyState";
import PaginationFooter from "../components/PaginationFooter";
import { usePagedTab } from "../usePagedTab";
import customer360Api from "@/lib/customer360Api";

const CHANNEL_ICONS: Record<string, any> = {
  CALL: Phone,
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
  MEETING: Users,
  OFFICE_VISIT: Building2,
  SITE_VISIT: MapPin,
  VIDEO_CALL: Video,
  NOTE: StickyNote,
};

const MOOD_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  POSITIVE: "success",
  NEUTRAL: "warning",
  NEGATIVE: "destructive",
};

export default function CommunicationTab({ customerId }: { customerId: string }) {
  const { items, page, setPage, totalPages, isLoading, reload } = usePagedTab<any>(
    (page, size) => customer360Api.getTimeline(customerId, page, size),
    [customerId]
  );
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    action: "Communication Logged",
    channel: "CALL",
    description: "",
    outcome: "",
    customerMood: "NEUTRAL",
    customerResponse: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = () => {
    setSaving(true);
    customer360Api
      .logCommunication(customerId, form)
      .then(() => {
        setIsOpen(false);
        setForm({ action: "Communication Logged", channel: "CALL", description: "", outcome: "", customerMood: "NEUTRAL", customerResponse: "" });
        reload();
      })
      .finally(() => setSaving(false));
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-end mb-4">
          <Button size="sm" onClick={() => setIsOpen(true)}><Plus className="w-4 h-4" /> Log Communication</Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No communication logged yet" description="Calls, WhatsApp, emails, meetings and visits will appear here." />
        ) : (
          <>
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
              {items.map((entry: any) => {
                const Icon = CHANNEL_ICONS[entry.channel] || StickyNote;
                return (
                  <div key={entry.id} className="relative">
                    <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-primary/15 border-2 border-primary flex items-center justify-center">
                      <Icon className="w-2.5 h-2.5 text-primary" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="font-medium text-foreground">{entry.performedByName}</span>
                      <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</span>
                      {entry.channel && <Badge variant="outline">{entry.channel.replace("_", " ")}</Badge>}
                      {entry.customerMood && <Badge variant={MOOD_VARIANT[entry.customerMood] || "secondary"}>{entry.customerMood}</Badge>}
                    </div>
                    <div className="text-sm font-medium">{entry.action}</div>
                    {entry.description && <p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p>}
                    {entry.customerResponse && (
                      <p className="text-sm mt-1 italic text-muted-foreground">"{entry.customerResponse}"</p>
                    )}
                    {entry.outcome && <div className="text-xs mt-1">Outcome: <span className="font-medium">{entry.outcome}</span></div>}
                    {entry.attachmentUrl && (
                      <a href={entry.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary mt-1">
                        <Paperclip className="w-3 h-3" /> {entry.attachmentFileName || "Attachment"}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
            <PaginationFooter page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </CardContent>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Log Communication</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Channel</Label>
                <select className="w-full h-9 rounded-md border border-input px-3 text-sm" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                  {Object.keys(CHANNEL_ICONS).map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Customer Mood</Label>
                <select className="w-full h-9 rounded-md border border-input px-3 text-sm" value={form.customerMood} onChange={(e) => setForm({ ...form, customerMood: e.target.value })}>
                  <option value="POSITIVE">Positive</option>
                  <option value="NEUTRAL">Neutral</option>
                  <option value="NEGATIVE">Negative</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Discussion Summary</Label>
              <textarea className="w-full min-h-[80px] rounded-md border border-input px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Customer Response</Label>
              <Input value={form.customerResponse} onChange={(e) => setForm({ ...form, customerResponse: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Outcome</Label>
              <Input value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !form.description}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
