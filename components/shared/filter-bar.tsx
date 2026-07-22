"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export type FilterFieldType = "select" | "date" | "text";

export interface FilterFieldConfig {
  key: string;
  label: string;
  type: FilterFieldType;
  placeholder?: string;
  options?: { label: string; value: string }[]; // required when type === "select"
}

interface FilterBarProps {
  fields: FilterFieldConfig[];
  values: Record<string, string | undefined>;
  onChange: (key: string, value: string | undefined) => void;
  onClear?: () => void;
  className?: string;
}

/**
 * Generic, reusable filter bar. Supported field types cover every filter
 * this app needs: status/category/area/kabadiwala/customer/paymentStatus
 * (type: "select"), date ranges (type: "date"), and free-text search
 * (type: "text").
 *
 * Example:
 *   <FilterBar
 *     fields={[
 *       { key: "status", label: "Status", type: "select", options: statusOptions },
 *       { key: "from", label: "From", type: "date" },
 *       { key: "to", label: "To", type: "date" },
 *     ]}
 *     values={params}
 *     onChange={(key, value) => setParams({ [key]: value })}
 *   />
 */
export function FilterBar({ fields, values, onChange, onClear, className }: FilterBarProps) {
  const hasActiveFilters = fields.some((f) => !!values[f.key]);

  return (
    <div className={`flex flex-wrap items-end gap-3 ${className ?? ""}`}>
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            {field.label}
          </label>

          {field.type === "select" && (
            <Select
              value={values[field.key] ?? ""}
              onValueChange={(v) => onChange(field.key, v || undefined)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={field.placeholder ?? "All"} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.type === "date" && (
            <Input
              type="date"
              className="w-[160px]"
              value={values[field.key] ?? ""}
              onChange={(e) => onChange(field.key, e.target.value || undefined)}
            />
          )}

          {field.type === "text" && (
            <Input
              type="text"
              placeholder={field.placeholder}
              className="w-[200px]"
              value={values[field.key] ?? ""}
              onChange={(e) => onChange(field.key, e.target.value || undefined)}
            />
          )}
        </div>
      ))}

      {hasActiveFilters && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className="mb-0.5">
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
