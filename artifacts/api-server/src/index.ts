import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { seed } from "@workspace/scripts";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function autoSeedIfEmpty() {
  try {
    const rows = await db.select().from(usersTable).limit(1);
    if (rows.length === 0) {
      logger.info("Empty database detected — running seed...");
      await seed();
      logger.info("Seed complete.");
    }
  } catch (err) {
    logger.error({ err }, "Auto-seed failed");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await autoSeedIfEmpty();
});
