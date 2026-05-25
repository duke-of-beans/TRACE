/**
 * TRACE — Notification Service
 *
 * Admin-controlled notification topology.
 * Operators and spotters don't self-configure alerts -
 * the admin sets the topology for the chapter.
 *
 * Push notifications are SIGNALS not CONTENT -
 * no intelligence in the push payload.
 */
import webpush from "web-push";
import { opsDb } from "../db/connection.js";
import {
  notificationChannels, notificationRules,
  notificationSubscriptions, reporters,
} from "../db/schema/vault-a.js";
import { eq, and } from "drizzle-orm";

// Configure VAPID (run once at startup)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@trace.local",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

type TriggerEvent = {
  event: string;                    // e.g. "new_sighting", "vehicle_promoted"
  chapterId: string;
  data: Record<string, unknown>;    // event-specific data
};

/**
 * Evaluate which notification channels should fire for an event.
 */
async function matchChannels(event: TriggerEvent): Promise<string[]> {
  const rules = await opsDb
    .select({
      channelId: notificationRules.channelId,
      config: notificationRules.triggerConfig,
    })
    .from(notificationRules)
    .innerJoin(
      notificationChannels,
      eq(notificationRules.channelId, notificationChannels.id)
    )
    .where(
      and(
        eq(notificationChannels.chapterId, event.chapterId),
        eq(notificationRules.enabled, true)
      )
    );

  const matched: string[] = [];
  for (const rule of rules) {
    const config = rule.config as { event: string; conditions?: Record<string, unknown> };
    if (config.event !== event.event) continue;

    // evaluate conditions if present
    if (config.conditions) {
      const pass = Object.entries(config.conditions).every(([key, val]) => {
        const actual = event.data[key];
        if (typeof val === "number" && typeof actual === "number") {
          return actual >= val;
        }
        return actual === val;
      });
      if (!pass) continue;
    }

    matched.push(rule.channelId);
  }

  return matched;
}

/**
 * Dispatch push notifications for an event.
 * Finds matching channels, resolves subscribers, sends push.
 * Push payload is a SIGNAL - no intelligence content.
 */
export async function dispatch(event: TriggerEvent): Promise<{
  channelsMatched: number;
  notificationsSent: number;
  errors: number;
}> {
  const channelIds = await matchChannels(event);
  if (channelIds.length === 0) return { channelsMatched: 0, notificationsSent: 0, errors: 0 };

  let sent = 0;
  let errors = 0;

  for (const channelId of channelIds) {
    // get subscribers
    const subs = await opsDb
      .select({
        reporterId: notificationSubscriptions.reporterId,
        push: reporters.pushSubscription,
      })
      .from(notificationSubscriptions)
      .innerJoin(reporters, eq(notificationSubscriptions.reporterId, reporters.id))
      .where(eq(notificationSubscriptions.channelId, channelId));

    for (const sub of subs) {
      if (!sub.push) continue;

      try {
        // SIGNAL only - no intelligence in payload
        await webpush.sendNotification(
          sub.push as webpush.PushSubscription,
          JSON.stringify({
            type: event.event,
            // no vehicle details, no location, no plate - just a ping
            timestamp: new Date().toISOString(),
          })
        );
        sent++;
      } catch {
        errors++;
      }
    }
  }

  return { channelsMatched: channelIds.length, notificationsSent: sent, errors };
}
