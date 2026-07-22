"use client";

import { useEffect, useState } from "react";
import { CalendarClock, PackageCheck, IndianRupee, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { StatCardSkeleton, CardSkeleton } from "@/components/shared/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KabadiwalaDashboardData {
  todaysPickups: number;
  completedPickups: number;
  todaysEarnings: number;
  monthlyEarnings: number;
  pickupTimeline: {
    id: string;
    status: string;
    scheduledDate: string;
    totalWeight: number | null;
    totalAmount: number | null;
    customer: { name: string; phone: string };
    address: { city: string; pincode: string };
  }[];
}

export default function KabadiwalaDashboardPage() {
  const [data, setData] = useState<KabadiwalaDashboardData | null>(null);

  useEffect(() => {
    fetch("/api/kabadiwala/dashboard")
      .then((res) => res.json())
      .then((json) => setData(json.data));
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Collector Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your pickups and earnings at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {!data ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Today's Pickups" value={data.todaysPickups} icon={CalendarClock} delay={0} />
            <StatCard
              label="Completed"
              value={data.completedPickups}
              icon={PackageCheck}
              delay={0.05}
            />
            <StatCard
              label="Today's Earnings"
              value={`₹${data.todaysEarnings.toLocaleString("en-IN")}`}
              icon={Wallet}
              accent="black"
              delay={0.1}
            />
            <StatCard
              label="Monthly Earnings"
              value={`₹${data.monthlyEarnings.toLocaleString("en-IN")}`}
              icon={IndianRupee}
              delay={0.15}
            />
          </>
        )}
      </div>

      <ScrollReveal>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pickup Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {!data && <CardSkeleton lines={5} />}
            {data && data.pickupTimeline.length === 0 && (
              <EmptyState
                title="No pickups yet"
                description="Assigned pickups will appear here."
              />
            )}
            {data && data.pickupTimeline.length > 0 && (
              <div className="space-y-3">
                {data.pickupTimeline.map((pickup) => (
                  <div
                    key={pickup.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{pickup.customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pickup.address.city} · {pickup.address.pincode} ·{" "}
                        {new Date(pickup.scheduledDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {pickup.totalAmount !== null && (
                        <span className="text-sm font-medium">
                          ₹{Number(pickup.totalAmount).toFixed(2)}
                        </span>
                      )}
                      <StatusBadge status={pickup.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>
    </main>
  );
}
