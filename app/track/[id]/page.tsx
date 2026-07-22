import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PickupTimeline } from "@/components/shared/pickup-timeline";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrackPageProps {
  params: { id: string };
}

/**
 * Public tracking page. Deliberately excludes customer PII (name, phone,
 * address) since this page is reachable by anyone who scans the QR code
 * printed on a pickup docket.
 */
export default async function TrackPickupPage({ params }: TrackPageProps) {
  const pickup = await prisma.pickupRequest.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      completedAt: true,
      totalWeight: true,
      createdAt: true,
      updatedAt: true,
      kabadiwala: { select: { name: true } },
      items: {
        select: {
          weight: true,
          category: { select: { name: true } },
        },
      },
    },
  });

  if (!pickup) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">
          ElectroFine Pickup Tracking
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Request #{pickup.id.slice(-8).toUpperCase()}
        </h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Current Status</CardTitle>
          <StatusBadge status={pickup.status} />
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>
            Scheduled for{" "}
            {pickup.scheduledDate.toLocaleDateString("en-IN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          {pickup.kabadiwala && <p>Assigned collector: {pickup.kabadiwala.name}</p>}
          {pickup.totalWeight ? <p>Total weight: {pickup.totalWeight} kg</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <PickupTimeline
            status={pickup.status}
            createdAt={pickup.createdAt}
            scheduledDate={pickup.scheduledDate}
            completedAt={pickup.completedAt}
          />
        </CardContent>
      </Card>

      {pickup.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pickup.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{item.category.name}</span>
                <span className="text-muted-foreground">{item.weight} kg</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
