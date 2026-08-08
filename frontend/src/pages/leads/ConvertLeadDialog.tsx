import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { leadApi } from "./leadApi";
import { type Lead } from "./constants";
import { TextAreaField } from "./fields";

export default function ConvertLeadDialog({
  open, onOpenChange, lead,
}: { open: boolean; onOpenChange: (open: boolean) => void; lead: Lead }) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    leadApi.convertFull(lead.id, { notes })
      .then((res) => {
        onOpenChange(false);
        navigate(`/customers/${res.data.customerId}`);
      })
      .catch((err) => {
        console.error("Conversion failed", err);
        setError(err?.response?.data?.message || "Failed to convert lead.");
      })
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Convert Lead to Customer</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A customer record will be created from <span className="font-medium text-foreground">{lead.name}</span>.
            All follow-ups, communications, site visits, measurements, quotations and documents stay
            linked to the lead history. A project is created later, once a quotation for this
            customer is approved.
          </p>
          <TextAreaField label="Conversion Notes" value={notes} onChange={setNotes} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
              {saving ? "Converting..." : "Convert Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
