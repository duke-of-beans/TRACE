import { opsDb } from "./src/db/connection.js";
import { sightings } from "./src/db/schema/vault-a.js";
import { like } from "drizzle-orm";

const result = await opsDb.delete(sightings).where(like(sightings.activityDescription, "DEMO:%"));
console.log("Cleared old demo sightings");
process.exit(0);
