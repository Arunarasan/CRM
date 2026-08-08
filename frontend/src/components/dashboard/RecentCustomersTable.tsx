import { RecentCustomer } from "@/types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function RecentCustomersTable({ customers, isLoading }: { customers: RecentCustomer[], isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="col-span-1 lg:col-span-2 shadow-sm rounded-xl border-border/40">
        <CardHeader>
          <CardTitle>Recent Customers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 lg:col-span-2 shadow-sm rounded-xl border-border/40 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: '700ms' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" />
          Recent Customers
        </CardTitle>
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-3">
            <Users className="h-10 w-10 text-muted/50" />
            <p>No customers added yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-lg">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Name</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c, idx) => (
                  <tr key={c.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${idx === customers.length - 1 ? 'border-none' : ''}`}>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-col">
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{c.company || 'N/A'}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-primary hover:underline font-medium text-xs">
                        Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
