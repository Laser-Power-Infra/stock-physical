import pg from "pg";

const BASE_DATE = "2026-10-13";
const MAX_DAYS_BEFORE = 15;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN");

    const base = await client.query(
      `UPDATE "PhysicalStock" SET form_date = $1::timestamp`,
      [`${BASE_DATE} 00:00:00`],
    );

    const dupes = await client.query(
      `WITH ranked AS (
         SELECT id,
                ROW_NUMBER() OVER (
                  PARTITION BY erp_code, location, l2_valve_type, l7_dimension,
                               l4_component, l5_material, l6_std, l8_item_category
                  ORDER BY created_at, id
                ) AS rn
         FROM "PhysicalStock"
       )
       UPDATE "PhysicalStock" p
       SET form_date = ($1::date - ((1 + floor(random() * $2::int))::int))::timestamp
       FROM ranked r
       WHERE p.id = r.id AND r.rn > 1`,
      [BASE_DATE, MAX_DAYS_BEFORE],
    );

    await client.query("COMMIT");

    console.log(`Set ${base.rowCount} row(s) to ${BASE_DATE}.`);
    console.log(
      `Re-dated ${dupes.rowCount} duplicate row(s) to a random date 1-${MAX_DAYS_BEFORE} days before ${BASE_DATE}.`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
