import { LeadStatusData } from "@/types/dashboard";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

export default function LeadPipelineChart({ data, isLoading }: { data: LeadStatusData[], isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="shadow-sm rounded-xl border-border/40">
        <CardHeader>
          <CardTitle>Lead Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="w-48 h-48 rounded-full bg-muted animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm rounded-xl border-border/40 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: '300ms' }}>
      <CardHeader>
        <CardTitle>Lead Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No leads found.
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
