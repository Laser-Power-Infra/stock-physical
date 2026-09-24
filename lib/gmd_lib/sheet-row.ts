import { COL_INDEX_TO_DB_FIELD } from "./sheet-columns";
import type { PhysicalStockRow } from "@/lib/gmdUpdateSlice";

const FIELD_BY_INDEX = Object.keys(COL_INDEX_TO_DB_FIELD)
  .map(Number)
  .sort((a, b) => a - b)
  .map((i) => COL_INDEX_TO_DB_FIELD[i]);

export function physicalStockRowToArray(row: PhysicalStockRow): unknown[] {
  return FIELD_BY_INDEX.map((field) => row[field as keyof PhysicalStockRow] ?? "");
}