import { useState } from "react";
import { StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { formatDateTime } from "../constants";
import { ListSkeleton, useLeadList } from "./shared";

export default function NotesTab({ leadId }: { leadId: string }) {
  const { items, loading, reload } = useLeadList<any>(() => leadApi.getNotes(leadId), [leadId]);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    leadApi.addNote(leadId, content.trim())
      .then(() => { setContent(""); reload(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  const remove = (note: any) => {
    if (!confirm("Delete this note?")) return;
    leadApi.deleteNote(leadId, note.id).then(reload).catch(console.error);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="flex gap-2">
          <textarea
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
            placeholder="Write an internal note about this lead..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button type="submit" disabled={saving || !content.trim()} className="self-end">
            {saving ? "Saving..." : "Add Note"}
          </Button>
        </form>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <EmptyState icon={StickyNote} title="No notes yet" />
        ) : (
          <div className="space-y-2">
            {items.map((note) => (
              <div key={note.id} className="border rounded-lg p-3 bg-amber-50/50 dark:bg-muted/30 flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {note.author?.name || "—"} · {formatDateTime(note.createdAt)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => remove(note)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
