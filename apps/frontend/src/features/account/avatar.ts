import type { Style, StyleMeta } from "@dicebear/core";
import type { AvatarStyle } from "shared-types";

/*
 * DiceBear avatars, drawn in the browser. Nothing is fetched from
 * dicebear.com: a self-hosted Warden shouldn't send every user's seed and IP
 * to an outside service on each page load.
 *
 * Each style is its own lazily loaded chunk (5–40 kB), so the navbar only
 * downloads the ONE style it shows. The all-in-one @dicebear/collection was
 * 2 MB / 678 kB gzipped, too much to pull in for a single face.
 */

type StyleModule = { create: Style<object>["create"]; meta?: StyleMeta; schema?: Style<object>["schema"] };

const STYLES: Record<AvatarStyle, () => Promise<StyleModule>> = {
  adventurer: () => import("@dicebear/adventurer"),
  adventurerNeutral: () => import("@dicebear/adventurer-neutral"),
  avataaars: () => import("@dicebear/avataaars"),
  avataaarsNeutral: () => import("@dicebear/avataaars-neutral"),
  bigEars: () => import("@dicebear/big-ears"),
  bigEarsNeutral: () => import("@dicebear/big-ears-neutral"),
  bigSmile: () => import("@dicebear/big-smile"),
  bottts: () => import("@dicebear/bottts"),
  botttsNeutral: () => import("@dicebear/bottts-neutral"),
  croodles: () => import("@dicebear/croodles"),
  croodlesNeutral: () => import("@dicebear/croodles-neutral"),
  dylan: () => import("@dicebear/dylan"),
  funEmoji: () => import("@dicebear/fun-emoji"),
  glass: () => import("@dicebear/glass"),
  icons: () => import("@dicebear/icons"),
  identicon: () => import("@dicebear/identicon"),
  lorelei: () => import("@dicebear/lorelei"),
  loreleiNeutral: () => import("@dicebear/lorelei-neutral"),
  micah: () => import("@dicebear/micah"),
  miniavs: () => import("@dicebear/miniavs"),
  notionists: () => import("@dicebear/notionists"),
  notionistsNeutral: () => import("@dicebear/notionists-neutral"),
  openPeeps: () => import("@dicebear/open-peeps"),
  personas: () => import("@dicebear/personas"),
  pixelArt: () => import("@dicebear/pixel-art"),
  pixelArtNeutral: () => import("@dicebear/pixel-art-neutral"),
  rings: () => import("@dicebear/rings"),
  shapes: () => import("@dicebear/shapes"),
  thumbs: () => import("@dicebear/thumbs"),
  toonHead: () => import("@dicebear/toon-head"),
};

const core = () => import("@dicebear/core");

/** An avatar as an <img src>. SVG in an <img> can't run scripts, so it's safe to show. */
export async function avatarUri(style: AvatarStyle, seed: string): Promise<string> {
  const [{ createAvatar }, mod] = await Promise.all([core(), STYLES[style]()]);
  // Each style has its own option types; we only pass `seed`, which they all take.
  return createAvatar(mod as Style<object>, { seed }).toDataUri();
}

export interface StyleCredit {
  title: string;
  creator: string;
  license: string;
  licenseUrl?: string;
}

/** Who made a style and under which licence. Several are CC BY 4.0, which requires credit. */
export async function styleCredit(style: AvatarStyle): Promise<StyleCredit> {
  const meta = (await STYLES[style]()).meta ?? {};
  return {
    title: meta.title ?? style,
    creator: meta.creator ?? "unknown",
    license: meta.license?.name ?? "see dicebear.com",
    licenseUrl: meta.license?.url,
  };
}

/** A fresh random seed, for "Shuffle". */
export const randomSeed = () => Math.random().toString(36).slice(2, 12);

/** "pixelArtNeutral" → "Pixel art neutral" */
export const styleLabel = (style: string) => {
  const words = style.replace(/([A-Z])/g, " $1").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
