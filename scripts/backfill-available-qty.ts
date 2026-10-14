import "dotenv/config";
import { prisma } from "../lib/prisma";
import { computeAvailableQty } from "../lib/gmd_lib/qty";

async function main() {
  const rows = await prisma.physicalStock.findMany({
    select: {
      id: true,
      received_qty: true,
      dispatch_qty: true,
      available_qty: true,
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const value = computeAvailableQty(row.received_qty, row.dispatch_qty);
    if (value === null) {
      skipped++;
      continue;
    }
    if (String(row.available_qty ?? "") === value) {
      skipped++;
      continue;
    }
    await prisma.physicalStock.update({
      where: { id: row.id },
      data: { available_qty: value },
    });
    updated++;
  }

  console.log(
    `available_qty = received - dispatch  →  total: ${rows.length}, updated: ${updated}, skipped: ${skipped}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });