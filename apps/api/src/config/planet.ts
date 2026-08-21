/**
 * Planet Labs API client helpers.
 *
 * Required env vars:
 *   PLANET_API_KEY        Planet API key (Settings → My Account)
 *   PLANET_WEBHOOK_SECRET Shared secret used to verify webhook delivery payloads
 *   API_BASE_URL          Public URL of this API (for webhook callback registration)
 *
 * Docs: https://developers.planet.com/docs/apis/
 */

import { env } from './env';
import { logger } from './logger';

const PLANET_BASE = 'https://api.planet.com';

export async function planetFetch<T>(
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<T> {
  const res = await fetch(`${PLANET_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `api-key ${env().PLANET_API_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 429 && attempt < 3) {
    const delay = Math.pow(2, attempt) * 1000;
    logger().warn({ attempt, delay }, 'planet: rate-limited, backing off');
    await new Promise((r) => setTimeout(r, delay));
    return planetFetch<T>(path, init, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Planet API ${res.status} on ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export function planetTileUrl(yearMonth: string): string {
  return `https://tiles.planet.com/basemaps/v1/planet-tiles/planet_medres_visual_${yearMonth}_mosaic/gmap/{z}/{x}/{y}.png?api_key=${env().PLANET_API_KEY}`;
}
