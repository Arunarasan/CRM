import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Wrench, Clock, LayoutDashboard,
  CheckCircle2, RefreshCw, Sparkles, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnderMaintenanceProps {
  moduleName: string;
  description?: string;
  expectedTime?: string;
}

export default function UnderMaintenance({
  moduleName,
  description,
  expectedTime = "Scheduled System Upgrade in Progress",
}: UnderMaintenanceProps) {
  const [notified, setNotified] = useState(false);

  const steps = [
    { name: "Database Schema Optimization", status: "Completed" },
    { name: "Real-time Ledger & Audit Sync", status: "In Progress" },
    { name: "Security & API Rate-Limit Enhancements", status: "Pending" },
  ];

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 lg:p-12 animate-in fade-in duration-300">
      <div className="max-w-3xl w-full bg-card border rounded-2xl p-8 md:p-12 shadow-xl shadow-amber-500/5 relative overflow-hidden text-center space-y-8">
        {/* Background Decorative Elements */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Status Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          Under Maintenance
        </div>

        {/* Icon & Glow */}
        <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-3xl opacity-20 blur-xl animate-pulse" />
          <div className="relative w-20 h-20 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
            <Wrench className="w-10 h-10 animate-bounce duration-1000" />
          </div>
        </div>

        {/* Header Text */}
        <div className="space-y-3 max-w-xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {moduleName} is Under Maintenance
          </h1>
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
            {description ||
              `We are currently upgrading the ${moduleName} module to enhance performance, reliability, and data synchronization. Thank you for your patience!`}
          </p>
        </div>

        {/* Progress & Info Box */}
        <div className="bg-muted/40 border rounded-xl p-5 text-left space-y-4 max-w-lg mx-auto">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Maintenance Status
            </span>
            <span className="text-amber-600 font-medium">{expectedTime}</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-foreground font-medium">
                  {step.status === "Completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : step.status === "In Progress" ? (
                    <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                  {step.name}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    step.status === "Completed"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : step.status === "In Progress"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link to="/dashboard">
            <Button variant="default" className="shadow-md">
              <LayoutDashboard className="w-4 h-4 mr-2" /> Go to Dashboard
            </Button>
          </Link>
          <Link to="/projects">
            <Button variant="outline">
              <Building2 className="w-4 h-4 mr-2" /> View Projects
            </Button>
          </Link>
          <Button
            variant="ghost"
            onClick={() => setNotified(!notified)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {notified ? (
              <span className="flex items-center text-emerald-600 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Notification set!
              </span>
            ) : (
              <span className="flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" /> Notify when online
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
