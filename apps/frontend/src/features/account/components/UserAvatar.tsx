import type { Avatar } from "shared-types";
import { useAvatarUri } from "../hooks/useAccount";

/**
 * A person's DiceBear avatar. Until the style library has loaded (first time
 * only), shows their initials in the same circle so nothing jumps.
 */
export function UserAvatar({ avatar, name, size = 30, className = "" }: { avatar?: Avatar; name: string; size?: number; className?: string }) {
  const uri = useAvatarUri(avatar);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const box = { width: size, height: size };
  if (uri.data) return <img src={uri.data} alt="" style={box} className={`shrink-0 rounded-full bg-chip ${className}`} />;
  return (
    <span style={{ ...box, fontSize: Math.max(9, size * 0.35) }} className={`grid shrink-0 place-items-center rounded-full bg-good-s font-semibold text-good ${className}`}>
      {initials}
    </span>
  );
}
