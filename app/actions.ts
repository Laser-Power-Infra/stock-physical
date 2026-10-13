"use server";

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { fetchPhysicalStockSheet } from "@/lib/gmd_lib/physical-stock-sheet";
import {
  COL_INDEX_TO_DB_FIELD,
  EDITABLE_FIELDS,
} from "@/lib/gmd_lib/sheet-columns";

const ERPC_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

async function generateUniqueErpCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "";
    for (let i = 0; i < 3; i++) {
      code += ERPC_LETTERS[Math.floor(Math.random() * ERPC_LETTERS.length)];
    }
    code += String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    const exists = await prisma.physicalStock.findFirst({
      where: { erp_code: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique ERP code.");
}

export interface CreatePhysicalStockInput {
  location?: string | null;
  l2_valve_type?: string | null;
  dimension?: string | null;
  l7_dimension?: string | null;
  l4_component?: string | null;
  l5_material?: string | null;
  l6_std?: string | null;
  l8_item_category?: string | null;
}

export async function createPhysicalStockAction(
  input: CreatePhysicalStockInput,
): Promise<{ success: boolean; id?: string; erp_code?: string; error?: string }> {
  try {
    const erp_code = await generateUniqueErpCode();
    await prisma.physicalStock.create({
      data: {
        erp_code,
        location: input.location?.trim().toUpperCase() || null,
        l2_valve_type: input.l2_valve_type?.trim().toUpperCase() || null,
        dimension: input.dimension?.trim().toUpperCase() || null,
        l7_dimension: input.l7_dimension?.trim().toUpperCase() || null,
        l4_component: input.l4_component?.trim().toUpperCase() || null,
        l5_material: input.l5_material?.trim().toUpperCase() || null,
        l6_std: input.l6_std?.trim().toUpperCase() || null,
        l8_item_category: input.l8_item_category?.trim().toUpperCase() || null,
      },
    });
    return { success: true, erp_code };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export interface FieldUpdateResult {
  id: string;
  field: string;
  value: string | null;
}

export async function updatePhysicalStockFieldAction(
  id: string,
  field: string,
  value: string | null,
): Promise<FieldUpdateResult> {
  const data: Record<string, string | null> = { [field]: value ?? null };
  await prisma.physicalStock.update({ where: { id }, data });
  return { id, field, value: value ?? null };
}

export async function updatePhysicalStockUsdCostAction(
  _id: string,
  _usdCost: string | null,
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  return {
    success: false,
    error: "USD cost conversion is not supported for physical stock rows.",
  };
}

const CONTENT_FIELDS = Array.from(
  new Set(Object.values(COL_INDEX_TO_DB_FIELD)),
).filter((field) => field !== "form_date");

function contentKey(record: Record<string, string | null>): string {
  const o: Record<string, string | null> = {};
  for (const field of CONTENT_FIELDS) {
    if (EDITABLE_FIELDS.includes(field)) continue;
    o[field] = record[field] ?? null;
  }
  return createHash("sha256").update(JSON.stringify(o)).digest("hex");
}

export async function syncPhysicalStockFromSheetAction(): Promise<{
  success: boolean;
  created?: number;
  skipped?: number;
  totalRows?: number;
  syncedAt?: string;
  error?: string;
}> {
  try {
    const rows = await fetchPhysicalStockSheet();

    const existing = await prisma.physicalStock.findMany();
    const byKey = new Map<string, string>();
    for (const row of existing) {
      const key = contentKey(
        row as unknown as Record<string, string | null>,
      );
      if (!byKey.has(key)) byKey.set(key, row.id);
    }

    const toCreate: Record<string, string | null>[] = [];
    const seen = new Set<string>();
    let skipped = 0;

    for (const sheetRow of rows) {
      const key = contentKey(sheetRow);
      if (seen.has(key) || byKey.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      toCreate.push(sheetRow);
    }

    if (toCreate.length > 0) {
      await prisma.physicalStock.createMany({ data: toCreate });
    }

    return {
      success: true,
      created: toCreate.length,
      skipped,
      totalRows: rows.length,
      syncedAt: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}