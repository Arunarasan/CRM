import { avatarColor } from "@/pages/leads/constants";

export interface TeamMember { userId?: number; name?: string; role?: string }

const initials = (name?: string) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

/**
 * Overlapping initial avatars for a lead / project / task team — first `max` shown, the rest as "+N".
 * Names and roles show on hover (native tooltip, so it never fights a clickable table row).
 */
export default function TeamAvatars({
  team, max = 3, size = "md", emptyLabel = "—",
}: { team?: TeamMember[]; max?: number; size?: "sm" | "md"; emptyLabel?: string }) {
  const members = (team || []).filter((m) => m.name);
  if (members.length === 0) return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[11px]";
  const title = members.map((m) => (m.role ? `${m.name} · ${m.role}` : m.name)).join("\n");
  return (
    <div className="flex items-center -space-x-2" title={title}>
      {shown.map((m, i) => (
        <span
          key={`${m.userId ?? m.name}-${i}`}
          className={`${dim} shrink-0 rounded-full ring-2 ring-card flex items-center justify-center font-semibold ${avatarColor(m.name)}`}
        >
          {initials(m.name)}
        </span>
      ))}
      {extra > 0 && (
        <span className={`${dim} shrink-0 rounded-full ring-2 ring-card bg-muted text-muted-foreground flex items-center justify-center font-semibold`}>
          +{extra}
        </span>
      )}
    </div>
  );
}
