"use client";

import { motion } from "framer-motion";
import { Check, Clock, PackageCheck, Truck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type PickupStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

interface PickupTimelineProps {
  status: PickupStatus;
  createdAt: Date;
  scheduledDate: Date;
  completedAt?: Date | null;
  className?: string;
}

const STEP_ORDER: PickupStatus[] = ["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED"];

const STEP_META = {
  PENDING: { label: "Requested", icon: Clock },
  ASSIGNED: { label: "Collector Assigned", icon: Truck },
  IN_PROGRESS: { label: "Pickup In Progress", icon: PackageCheck },
  COMPLETED: { label: "Completed", icon: Check },
} as const;

/**
 * Reusable vertical progress timeline. Used on the public tracking page as
 * well as customer/kabadiwala dashboards.
 */
export function PickupTimeline({
  status,
  createdAt,
  scheduledDate,
  completedAt,
  className,
}: PickupTimelineProps) {
  if (status === "CANCELLED") {
    return (
      <div className={cn("flex items-center gap-3 text-red-600", className)}>
        <XCircle className="h-5 w-5" />
        <span className="text-sm font-medium">This pickup request was cancelled</span>
      </div>
    );
  }

  const currentIndex = STEP_ORDER.indexOf(status);

  return (
    <ol className={cn("relative space-y-6 border-l pl-6", className)}>
      {STEP_ORDER.map((step, idx) => {
        const meta = STEP_META[step];
        const Icon = meta.icon;
        const isComplete = idx <= currentIndex;
        const isCurrent = idx === currentIndex;

        return (
          <motion.li
            key={step}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.3 }}
            className="relative"
          >
            <span
              className={cn(
                "absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background",
                isComplete
                  ? "border-primary text-primary"
                  : "border-muted text-muted-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <p
              className={cn(
                "text-sm font-medium",
                isCurrent && "text-primary",
                !isComplete && "text-muted-foreground"
              )}
            >
              {meta.label}
            </p>
            {step === "PENDING" && (
              <p className="text-xs text-muted-foreground">
                {createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            )}
            {step === "COMPLETED" && completedAt && (
              <p className="text-xs text-muted-foreground">
                {completedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            )}
            {step === "ASSIGNED" && (
              <p className="text-xs text-muted-foreground">
                Scheduled for{" "}
                {scheduledDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}
