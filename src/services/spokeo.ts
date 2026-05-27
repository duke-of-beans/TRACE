/**
 * TRACE — Spokeo Service
 *
 * Phone number lookup via Spokeo API.
 * Returns name, carrier, line type, spam risk, social profiles.
 * Results cached in ops.known_numbers.spokeo_result.
 */
import { opsDb } from "../db/connection.js";
import { knownNumbers } from "../db/schema/vault-a.js";
import { getApiKey, incrementLookupCount } from "../api/integrations/index.js";
import { eq } from "drizzle-orm";

export type SpokeoResult = {
  found: boolean;
  name?: string;
  age?: string;
  address?: string;
  carrier?: string;
  lineType?: string;
  spamRisk?: string;
  socialProfiles?: string[];
  source: "spokeo" | "cache";
  raw?: Record<string, unknown>;
};

/**
 * Look up a phone number via Spokeo. Checks cached result first.
 * Returns null if Spokeo is not configured or disabled.
 */
export async function lookupPhoneSpokeo(
  phoneNumber: string,
  chapterId: string,
  knownNumberId?: string
): Promise<SpokeoResult | null> {
  const apiKey = await getApiKey(chapterId, "spokeo");
  if (!apiKey) return null;

  const digits = phoneNumber.replace(/\D/g, "");

  // Check cache on known_numbers if we have the ID
  if (knownNumberId) {
    const [cached] = await opsDb
      .select({ spokeoResult: knownNumbers.spokeoResult, spokeoLookupAt: knownNumbers.spokeoLookupAt })
      .from(knownNumbers)
      .where(eq(knownNumbers.id, knownNumberId))
      .limit(1);

    if (cached?.spokeoResult && cached.spokeoLookupAt) {
      const ageHours = (Date.now() - new Date(cached.spokeoLookupAt).getTime()) / 3600000;
      if (ageHours < 24 * 30) {
        const r = cached.spokeoResult as any;
        return { found: true, name: r.name, carrier: r.carrier, lineType: r.lineType, spamRisk: r.spamRisk, source: "cache", raw: r };
      }
    }
  }

  // Query Spokeo API
  try {
    const res = await fetch(`https://api.spokeo.com/v1/search?phone=${digits}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    await incrementLookupCount(chapterId, "spokeo");

    if (!res.ok || res.status === 404) {
      return { found: false, source: "spokeo" };
    }

    const data = await res.json();
    const result: SpokeoResult = {
      found: true,
      name: data.name || data.full_name || undefined,
      age: data.age || undefined,
      address: data.address || data.current_address || undefined,
      carrier: data.carrier || undefined,
      lineType: data.line_type || data.phone_type || undefined,
      spamRisk: data.spam_risk || data.spam_score || undefined,
      socialProfiles: data.social_profiles || undefined,
      source: "spokeo",
      raw: data,
    };

    // Cache result on known_numbers
    if (knownNumberId) {
      await opsDb.update(knownNumbers).set({
        spokeoResult: data,
        spokeoLookupAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(knownNumbers.id, knownNumberId));
    }

    return result;
  } catch {
    return { found: false, source: "spokeo" };
  }
}
