import Link from "next/link";
import { Recycle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <ScrollReveal>
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Recycle className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">ElectroFine</h1>
          <p className="max-w-md text-muted-foreground">
            Schedule e-waste pickups, track your collector in real time, and get paid
            fairly for what you recycle.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/login">Get Started</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </ScrollReveal>
    </main>
  );
}
