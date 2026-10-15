import { useState } from "react";
import toast from "react-hot-toast";
import { AVATAR_STYLES, type Avatar, type AvatarStyle } from "shared-types";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { apiMessage } from "../../../utils/apiMessage";
import { randomSeed, styleLabel } from "../avatar";
import { useStyleCredit, useUpdateProfile } from "../hooks/useAccount";
import { UserAvatar } from "./UserAvatar";

const FACES = 5;
const fiveSeeds = (keep?: string) => [...(keep ? [keep] : []), ...Array.from({ length: FACES }, randomSeed)].slice(0, FACES);

/** Every DiceBear style, five faces of the chosen one, Shuffle for five more. */
export function AvatarPicker({ current, name, onClose }: { current: Avatar; name: string; onClose: () => void }) {
  const [style, setStyle] = useState<AvatarStyle>(current.style);
  const [seeds, setSeeds] = useState(() => fiveSeeds(current.seed));
  const [picked, setPicked] = useState<Avatar>(current);
  const save = useUpdateProfile();
  const credit = useStyleCredit(style);

  const chooseStyle = (s: AvatarStyle) => {
    setStyle(s);
    const next = fiveSeeds(s === current.style ? current.seed : undefined);
    setSeeds(next);
    setPicked({ style: s, seed: next[0] });
  };
  const shuffle = () => {
    const next = fiveSeeds();
    setSeeds(next);
    setPicked({ style, seed: next[0] });
  };
  const onSave = () =>
    save.mutate(
      { avatar: picked },
      {
        onSuccess: () => {
          toast.success("Avatar updated");
          onClose();
        },
        onError: (e) => toast.error(apiMessage(e)),
      },
    );
  const unchanged = picked.style === current.style && picked.seed === current.seed;

  return (
    <Modal
      open
      onClose={onClose}
      width="w-[760px]"
      title="Choose an avatar"
      description="Pick a style, then one of its faces. Shuffle for five new ones."
      footer={
        <>
          <Button variant="secondary" onClick={shuffle} className="px-3.5 py-2 text-xs">
            Shuffle
          </Button>
          <Button onClick={onSave} loading={save.isPending} disabled={unchanged}>
            Save avatar
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-4" role="radiogroup" aria-label={`${styleLabel(style)} faces`}>
        {seeds.map((seed) => {
          const on = picked.style === style && picked.seed === seed;
          return (
            <button
              key={seed}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Face ${seeds.indexOf(seed) + 1}`}
              onClick={() => setPicked({ style, seed })}
              className={`cursor-pointer rounded-full p-1 ring-2 transition ${on ? "ring-strong" : "ring-transparent hover:ring-fieldb"}`}
            >
              <UserAvatar avatar={{ style, seed }} name={name} size={84} />
            </button>
          );
        })}
      </div>

      <p className="m-0 text-[11px] text-sand">
        {credit.data ? (
          <>
            {credit.data.title} by {credit.data.creator} ·{" "}
            {credit.data.licenseUrl ? (
              <a href={credit.data.licenseUrl} target="_blank" rel="noreferrer" className="text-link">
                {credit.data.license}
              </a>
            ) : (
              credit.data.license
            )}
          </>
        ) : (
          " "
        )}
      </p>

      <div>
        <p className="m-0 mb-2 text-xs text-label">Style · {AVATAR_STYLES.length} to choose from</p>
        <div className="grid max-h-[260px] grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 overflow-y-auto pr-1" role="radiogroup" aria-label="Avatar style">
          {AVATAR_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={s === style}
              onClick={() => chooseStyle(s)}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-2 py-1.5 text-left ${s === style ? "border-strong bg-raised" : "border-cb bg-field hover:border-fieldb"}`}
            >
              <UserAvatar avatar={{ style: s, seed: "warden" }} name={s} size={26} />
              <span className="truncate text-[11px] text-body">{styleLabel(s)}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
