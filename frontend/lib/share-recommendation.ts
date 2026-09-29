import type { Mode, Place } from "./recommendations";

export type SharedRecommendation = {
  mode: Mode;
  radius: number;
  restaurants: Place[];
  notices: string[];
};

export const SHARE_HASH_KEY = "recommendation";
const MAX_ENCODED_LENGTH = 16000;
const INVALID_LINK = "공유 링크가 올바르지 않아요. 새로운 추천을 받아보세요.";

// A self-contained snapshot keeps the same results across devices and server
// restarts. Only displayed restaurant data is included, never the user's GPS.
export function createRecommendationShareUrl(
  origin: string,
  recommendation: SharedRecommendation,
): string {
  const payload = {
    v: 1,
    m: recommendation.mode,
    r: recommendation.radius,
    p: recommendation.restaurants.map((place) => [
      place.id,
      place.name,
      place.category,
      place.foodType,
      place.distanceMeters,
      place.reason,
      place.address,
      place.phone,
    ]),
    n: recommendation.notices,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const encoded = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  // Use the same validation for creation and opening a link.
  readSharedRecommendation(`#${SHARE_HASH_KEY}=${encoded}`);
  const url = new URL("/", origin);
  url.hash = `${SHARE_HASH_KEY}=${encoded}`;
  return url.toString();
}

export function readSharedRecommendation(
  hash: string,
): SharedRecommendation | null {
  if (!hash.startsWith(`#${SHARE_HASH_KEY}=`)) return null;
  try {
    if (hash.length > MAX_ENCODED_LENGTH + SHARE_HASH_KEY.length + 2)
      throw new Error();
    const encoded = new URLSearchParams(hash.slice(1)).get(SHARE_HASH_KEY);
    if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error();
    const raw = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
    const payload: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (!isRecord(payload) || payload.v !== 1) throw new Error();
    if (payload.m !== "survey" && payload.m !== "random") throw new Error();
    if (
      typeof payload.r !== "number" ||
      !Number.isInteger(payload.r) ||
      payload.r < 100 ||
      payload.r > 3000
    )
      throw new Error();
    if (
      !Array.isArray(payload.p) ||
      payload.p.length < 1 ||
      payload.p.length > (payload.m === "random" ? 1 : 3)
    )
      throw new Error();
    const restaurants = payload.p.map(readPlace);
    if (
      new Set(restaurants.map((place) => place.id)).size !== restaurants.length
    )
      throw new Error();
    if (
      !Array.isArray(payload.n) ||
      payload.n.length > 5 ||
      !payload.n.every((notice) => isText(notice, 300))
    )
      throw new Error();
    return {
      mode: payload.m,
      radius: payload.r,
      restaurants,
      notices: payload.n,
    };
  } catch {
    throw new Error(INVALID_LINK);
  }
}

function readPlace(value: unknown): Place {
  if (!Array.isArray(value) || value.length !== 8) throw new Error();
  const [id, name, category, foodType, distance, reason, address, phone] =
    value;
  if (
    !isText(id, 64) ||
    !/^[0-9]+$/.test(id) ||
    !isText(name, 200) ||
    !name.trim() ||
    !isText(category, 100) ||
    !isText(foodType, 200) ||
    typeof distance !== "number" ||
    !Number.isInteger(distance) ||
    distance < 0 ||
    distance > 3000 ||
    !isText(reason, 300) ||
    !isText(address, 300) ||
    !isText(phone, 50)
  )
    throw new Error();
  return {
    id,
    name,
    category,
    foodType,
    distanceMeters: distance,
    reason,
    address,
    phone,
    // Never accept an arbitrary external URL from a shared payload.
    placeUrl: `https://place.map.kakao.com/${id}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.length <= limit;
}
