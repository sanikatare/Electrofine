import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type KnownStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "PAID"
  | "FAILED"
  | "APPROVED"
  | "REJECTED"
  | "AVAILABLE"
  | "BUSY"
  | "OFFLINE";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  ASSIGNED: "bg-blue-100 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800 border-indigo-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  PAID: "bg-green-100 text-green-800 border-green-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  AVAILABLE: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  BUSY: "bg-amber-100 text-amber-800 border-amber-200",
  OFFLINE: "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "In Progress",
};

interface StatusBadgeProps {
  status: KnownStatus | (string & {});
  className?: string;
}

/**
 * Renders a colored badge for any status-like value across the app
 * (pickup status, payment status, feedback moderation, availability).
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, " ");

  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", style, className)}
    >
      {label.toLowerCase()}
    </Badge>
  );
}
