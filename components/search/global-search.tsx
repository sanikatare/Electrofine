"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchResults {
  customers: { id: string; name: string; phone: string }[];
  kabadiwalas: { id: string; name: string; phone: string }[];
  pickups: { id: string; status: string }[];
  categories: { id: string; name: string }[];
  payments: { id: string; amount: number; status: string }[];
}

const EMPTY_RESULTS: SearchResults = {
  customers: [],
  kabadiwalas: [],
  pickups: [],
  categories: [],
  payments: [],
};

/**
 * Reusable global search box. Debounces input, queries /api/search, and
 * shows a grouped dropdown of matches across all five entity types the
 * current user is allowed to search.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults(EMPTY_RESULTS);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setResults(json.data ?? EMPTY_RESULTS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasAnyResults =
    results.customers.length +
      results.kabadiwalas.length +
      results.pickups.length +
      results.categories.length +
      results.payments.length >
    0;

  const goTo = (path: string) => {
    setOpen(false);
    setQuery("");
    router.push(path);
  };

  return (
    <div ref={containerRef} className={`relative w-full max-w-sm ${className ?? ""}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search customers, pickups, kabadiwalas…"
          className="pl-8"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && debouncedQuery.trim().length >= 2 && (
        <div className="absolute z-50 mt-2 w-full rounded-md border bg-popover p-2 shadow-lg">
          {!hasAnyResults && !loading && (
            <p className="p-2 text-sm text-muted-foreground">No results found.</p>
          )}

          {results.customers.length > 0 && (
            <ResultGroup title="Customers">
              {results.customers.map((c) => (
                <ResultItem
                  key={c.id}
                  onClick={() => goTo(`/admin/customers/${c.id}`)}
                  primary={c.name}
                  secondary={c.phone}
                />
              ))}
            </ResultGroup>
          )}

          {results.kabadiwalas.length > 0 && (
            <ResultGroup title="Kabadiwalas">
              {results.kabadiwalas.map((k) => (
                <ResultItem
                  key={k.id}
                  onClick={() => goTo(`/admin/kabadiwalas/${k.id}`)}
                  primary={k.name}
                  secondary={k.phone}
                />
              ))}
            </ResultGroup>
          )}

          {results.pickups.length > 0 && (
            <ResultGroup title="Pickup Requests">
              {results.pickups.map((p) => (
                <ResultItem
                  key={p.id}
                  onClick={() => goTo(`/track/${p.id}`)}
                  primary={`#${p.id.slice(-8).toUpperCase()}`}
                  secondary={p.status.replace(/_/g, " ")}
                />
              ))}
            </ResultGroup>
          )}

          {results.categories.length > 0 && (
            <ResultGroup title="Categories">
              {results.categories.map((c) => (
                <ResultItem
                  key={c.id}
                  onClick={() => goTo(`/admin/categories/${c.id}`)}
                  primary={c.name}
                />
              ))}
            </ResultGroup>
          )}

          {results.payments.length > 0 && (
            <ResultGroup title="Payments">
              {results.payments.map((p) => (
                <ResultItem
                  key={p.id}
                  onClick={() => goTo(`/admin/payments/${p.id}`)}
                  primary={`₹${p.amount.toFixed(2)}`}
                  secondary={p.status}
                />
              ))}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ResultItem({
  primary,
  secondary,
  onClick,
}: {
  primary: string;
  secondary?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
    >
      <span className="font-medium">{primary}</span>
      {secondary && (
        <span className="text-xs capitalize text-muted-foreground">{secondary}</span>
      )}
    </button>
  );
}
