import { NextResponse } from "next/server";
import { syncPhysicalStockFromSheetAction } from "@/app/actions";

export async function POST() {
  const result = await syncPhysicalStockFromSheetAction();
  return NextResponse.json(result);
}