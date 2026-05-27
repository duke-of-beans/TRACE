/**
 * TRACE — CarAPI Service
 *
 * Resolves license plates to vehicle details via carapi.app.
 * Plate + state → VIN → year/make/model/trim/color/body_type.
 * Results cached in ops.vehicle_enrichments (30-day expiry).
 * ~$0.30 per lookup. Keys stored encrypted in integration_config.
 */
import { opsDb } from "../db/connection.js";
import { vehicleEnrichments } from "../db/schema/vault-a.js";
import { getApiKey, incrementLookupCount } from "../api/integrations/index.js";
import { eq, and, gt } from "drizzle-orm";

export type CarApiResult = {
  found: boolean;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  color?: string;
  bodyType?: string;
  source: "carapi" | "cache";
  raw?: Record<string, unknown>;
};

/**
 * Look up a plate via CarAPI. Checks cache first.
 * Returns null if CarAPI is not configured or disabled.
 */
export async function lookupPlateCarApi(
  plate: string,
  state: string,
  chapterId: string
): Promise<CarApiResult | null> {
  const apiKey = await getApiKey(chapterId, "carapi");
  if (!apiKey) return null;

  const normalized = plate.toUpperCase().replace(/[\s-]/g, "");

  // 1. Authenticate with CarAPI
  let jwt: string;
  try {
    const authRes = await fetch("https://carapi.app/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_token: apiKey }),
    });
    if (!authRes.ok) return null;
    jwt = await authRes.text();
  } catch {
    return null;
  }

  // 2. Look up plate
  try {
    const lookupRes = await fetch(
      `https://carapi.app/api/plate-lookup/${normalized}?state=${encodeURIComponent(state)}`,
      { headers: { Authorization: `Bearer ${jwt}` } }
    );

    await incrementLookupCount(chapterId, "carapi");

    if (!lookupRes.ok) {
      return { found: false, source: "carapi" };
    }

    const data = await lookupRes.json();

    const result: CarApiResult = {
      found: true,
      vin: data.vin || undefined,
      year: data.year || undefined,
      make: data.make || undefined,
      model: data.model || undefined,
      trim: data.trim || undefined,
      color: data.color || undefined,
      bodyType: data.body_type || data.bodyType || undefined,
      source: "carapi",
      raw: data,
    };

    return result;
  } catch {
    return { found: false, source: "carapi" };
  }
}

/**
 * Cache a CarAPI result in vehicle_enrichments.
 * Links to an existing vehicle or creates a standalone record.
 */
export async function cacheEnrichment(
  vehicleId: string,
  result: CarApiResult
): Promise<void> {
  if (!result.found) return;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await opsDb.insert(vehicleEnrichments).values({
    vehicleId,
    source: "carapi",
    vin: result.vin || null,
    year: result.year || null,
    make: result.make || null,
    model: result.model || null,
    trim: result.trim || null,
    color: result.color || null,
    bodyType: result.bodyType || null,
    rawResponse: result.raw || null,
    expiresAt,
  });
}
