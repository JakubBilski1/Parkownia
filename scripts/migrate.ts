import { existsSync } from "node:fs";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "@/db";

const MIGRATIONS_FOLDER = "./drizzle";

async function main() {
  if (!existsSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`)) {
    throw new Error("No migrations found — run `npm run db:generate` first.");
  }

  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("Migrations applied.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
