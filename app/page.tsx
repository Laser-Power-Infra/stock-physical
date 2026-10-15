"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSelector } from "@reduxjs/toolkit";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import GMDUpdateTable from "@/components/gmd_dashboard/GMDUpdateTable";
import GMDUpdateHeader from "@/components/gmd_dashboard/GMDUpdateHeader";
import PhysicalStockFormDialog from "@/components/gmd_dashboard/PhysicalStockFormDialog";
import StockAnalyticsSidebar, {
  type StockCardKind,
  type MajorMinorKind,
} from "@/components/gmd_dashboard/StockAnalyticsSidebar";
import {
  COLUMNS,
  COL_INDEX_TO_DB_FIELD,
  EDITABLE_COLUMNS,
  HIDDEN_COLUMNS,
} from "@/lib/gmd_lib/sheet-columns";
import { physicalStockRowToArray } from "@/lib/gmd_lib/sheet-row";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  hydrateGMDUpdate,
  updateGMDUpdateField,
  updateGMDUpdateQty,
  selectAllGMDUpdateRows,
} from "@/lib/gmdUpdateSlice";
import type { PhysicalStockRow } from "@/lib/gmdUpdateSlice";

interface PhysicalStockApiResponse {
  headers: string[];
  items: PhysicalStockRow[];
  totalRows: number;
}

const AVAILABLE_IDX = COLUMNS.indexOf("AVAILABLE QTY.");
const RATE_IDX = COLUMNS.indexOf("rate/unit");
const MAJOR_IDX = COLUMNS.indexOf("MAJOR/MINOR MARKING");

function toNum(value: unknown): number {
  const n = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const selectRows = createSelector(
  [selectAllGMDUpdateRows],
  (items) => items.map((row) => physicalStockRowToArray(row)),
);
const selectIds = createSelector(
  [selectAllGMDUpdateRows],
  (items) => items.map((row) => row.id),
);

export default function Home() {
  const dispatch = useAppDispatch();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [filteredRows, setFilteredRows] = useState<unknown[][]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [cardFilter, setCardFilter] = useState<StockCardKind | null>(null);
  const [majorMinorFilter, setMajorMinorFilter] = useState<Set<MajorMinorKind>>(
    new Set(),
  );

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/physical-stock", { cache: "no-store" });
      const data: PhysicalStockApiResponse = await res.json();
      dispatch(hydrateGMDUpdate(data.items));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to load physical stock data.",
      );
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rows = useAppSelector(selectRows);
  const ids = useAppSelector(selectIds);
  const totalRows = useMemo(() => rows.length, [rows]);

  const baseRows = useMemo(() => {
    if (!cardFilter) return { rows, ids };
    const rowsOut: unknown[][] = [];
    const idsOut: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const qty = toNum(row[AVAILABLE_IDX]);
      const rate = toNum(row[RATE_IDX]);
      if (cardFilter === "qty" && qty <= 0) continue;
      if (cardFilter === "value" && rate * qty <= 0) continue;
      rowsOut.push(row);
      idsOut.push(ids[i]);
    }
    return { rows: rowsOut, ids: idsOut };
  }, [rows, ids, cardFilter]);

  const majorMinorCounts = useMemo(() => {
    const counts: Record<MajorMinorKind, number> = { yes: 0, no: 0, blank: 0 };
    for (const row of baseRows.rows) {
      const value = row[MAJOR_IDX];
      if (value === true) counts.yes++;
      else if (value === false) counts.no++;
      else counts.blank++;
    }
    return counts;
  }, [baseRows]);

  const { displayRows, displayIds } = useMemo(() => {
    if (majorMinorFilter.size === 0) {
      return { displayRows: baseRows.rows, displayIds: baseRows.ids };
    }
    const rowsOut: unknown[][] = [];
    const idsOut: string[] = [];
    for (let i = 0; i < baseRows.rows.length; i++) {
      const value = baseRows.rows[i][MAJOR_IDX];
      const kind: MajorMinorKind =
        value === true ? "yes" : value === false ? "no" : "blank";
      if (!majorMinorFilter.has(kind)) continue;
      rowsOut.push(baseRows.rows[i]);
      idsOut.push(baseRows.ids[i]);
    }
    return { displayRows: rowsOut, displayIds: idsOut };
  }, [baseRows, majorMinorFilter]);

  const toggleMajorMinor = useCallback((kind: MajorMinorKind) => {
    setMajorMinorFilter((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const { availableQty, availableValue } = useMemo(() => {
    let qty = 0;
    let value = 0;
    for (const row of filteredRows) {
      const available = toNum(row[AVAILABLE_IDX]);
      const rate = toNum(row[RATE_IDX]);
      qty += available;
      value += rate * available;
    }
    return { availableQty: qty, availableValue: value };
  }, [filteredRows]);

  const handleCellUpdate = useCallback(
    async (id: string, colIndex: number, value: string) => {
      const field = COL_INDEX_TO_DB_FIELD[colIndex];
      if (!field) return;
      const header = COLUMNS[colIndex];
      const toastId = toast.loading(`Updating ${header}...`);
      try {
        if (field === "received_qty" || field === "dispatch_qty") {
          await dispatch(updateGMDUpdateQty({ id, field, value })).unwrap();
        } else {
          await dispatch(updateGMDUpdateField({ id, field, value })).unwrap();
        }
        toast.success(`${header} updated`, { id: toastId });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : `Failed to update ${header}`,
          { id: toastId },
        );
      }
    },
    [dispatch],
  );

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/physical-stock/sync", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Sync failed.");
      } else {
        toast.success(
          `Synced ${data.totalRows} rows from the sheet (${data.created} new, ${data.skipped} unchanged).`,
        );
        setSyncedAt(data.syncedAt ?? null);
        await loadData();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }, [loadData]);

  return (
    <main className="flex flex-col bg-background h-[calc(100vh-64px)] overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
        <GMDUpdateHeader
          totalRows={totalRows}
          syncedAt={syncedAt}
          onSync={handleSync}
          syncing={syncing}
          title="Physical Stock"
          onNew={() => setShowNewDialog(true)}
        />
        <PhysicalStockFormDialog
          open={showNewDialog}
          onOpenChange={setShowNewDialog}
          onCreated={loadData}
        />
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Loading physical stock...
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex gap-4 mt-4">
            <StockAnalyticsSidebar
              availableQty={availableQty}
              availableValue={availableValue}
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((c) => !c)}
              activeCard={cardFilter}
              onCardClick={(kind) =>
                setCardFilter((prev) => (prev === kind ? null : kind))
              }
              majorMinorSelection={majorMinorFilter}
              majorMinorCounts={majorMinorCounts}
              onToggleMajorMinor={toggleMajorMinor}
            />
            <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
              <GMDUpdateTable
                headers={COLUMNS}
                rows={displayRows}
                ids={displayIds}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
                title="Physical Stock"
                editable
                editableColumns={EDITABLE_COLUMNS}
                onCellUpdate={handleCellUpdate}
                onFilteredRowsChange={setFilteredRows}
                blankOnlyEditableColumns={["ERP CODE"]}
                fullHeight
                hiddenColumns={HIDDEN_COLUMNS}
              />
            </div>
          </div>
        )}
        {syncing && (
          <div className="fixed bottom-4 right-4 flex items-center gap-1.5 rounded-lg bg-[#0a2540] text-white px-3 py-2 text-xs font-semibold shadow-lg">
            <RefreshCw size={12} className="animate-spin" />
            Syncing sheet...
          </div>
        )}
      </div>
    </main>
  );
}