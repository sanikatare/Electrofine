import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-7 w-7 text-destructive" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Access denied</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          You don&apos;t have permission to view this page with your current account.
        </p>
      </div>
      <Button asChild>
        <Link href="/login">Sign in with a different account</Link>
      </Button>
    </main>
  );
}
