import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Field {
  label: string;
  value?: string | null;
}

function InfoGrid({ fields }: { fields: Field[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {fields.map((f) => (
        <div key={f.label}>
          <div className="text-xs text-muted-foreground">{f.label}</div>
          <div className="text-sm font-medium">{f.value || "—"}</div>
        </div>
      ))}
    </div>
  );
}

export default function ProfileTab({ customerId }: { customerId: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    api
      .get(`/customers/${customerId}`)
      .then((res) => setProfile(res.data))
      .finally(() => setIsLoading(false));
  }, [customerId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
        <CardContent>
          <InfoGrid
            fields={[
              { label: "Full Name", value: profile?.name },
              { label: "Phone", value: profile?.phone },
              { label: "Alternate Phone", value: profile?.alternatePhone },
              { label: "WhatsApp Number", value: profile?.whatsappNumber },
              { label: "Email", value: profile?.email },
              { label: "Contact Person", value: profile?.contactPersonName },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Business Information</CardTitle></CardHeader>
        <CardContent>
          <InfoGrid
            fields={[
              { label: "Company Name", value: profile?.companyName },
              { label: "Customer Type", value: profile?.customerType },
              { label: "GST Number", value: profile?.gstNumber },
              { label: "PAN Number", value: profile?.panNumber },
              { label: "Website", value: profile?.website },
              { label: "Credit Limit", value: profile?.creditLimit ? `₹${profile.creditLimit.toLocaleString("en-IN")}` : undefined },
              { label: "Payment Terms", value: profile?.paymentTerms },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Address</CardTitle></CardHeader>
        <CardContent>
          <InfoGrid
            fields={[
              { label: "Billing Address", value: profile?.billingAddress },
              { label: "Shipping / Site Address", value: profile?.siteAddress },
              { label: "City", value: profile?.city },
              { label: "District", value: profile?.district },
              { label: "State", value: profile?.state },
              { label: "Country", value: profile?.country },
              { label: "Pincode", value: profile?.pincode },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Preferences</CardTitle></CardHeader>
        <CardContent>
          <InfoGrid
            fields={[
              { label: "Preferred Language", value: profile?.preferredLanguage },
              { label: "Preferred Contact Method", value: profile?.preferredContactMethod },
              { label: "Customer Since", value: profile?.customerSince ? new Date(profile.customerSince).toLocaleDateString() : undefined },
            ]}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-sm">Tags & Labels</CardTitle></CardHeader>
        <CardContent>
          {profile?.tags?.length ? (
            <div className="flex flex-wrap gap-2">
              {profile.tags.map((t: any) => (
                <Badge key={t.id ?? t.name} variant="secondary">{t.name}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tags assigned yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {profile?.notes?.length ? (
            profile.notes.map((n: any) => (
              <div key={n.id} className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{n.noteType || "Note"}</span>
                  <span>{n.authorName} · {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ""}</span>
                </div>
                <p className="text-sm">{n.content}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
