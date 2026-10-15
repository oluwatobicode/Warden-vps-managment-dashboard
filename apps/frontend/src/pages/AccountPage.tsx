import { useSearchParams } from "react-router";
import { PageHeader } from "../components/layout/PageHeader";
import { Tabs } from "../components/ui/Tabs";
import { useAuth } from "../features/auth/hooks/useAuth";
import { ProfileCard } from "../features/account/components/ProfileCard";
import { PasswordCard } from "../features/account/components/PasswordCard";
import { SessionsCard } from "../features/account/components/SessionsCard";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "password", label: "Password" },
  { id: "sessions", label: "Sessions" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/**
 * /account : your own profile, avatar, password and sessions. Every role has it.
 * The open tab lives in ?tab= so a reload or a shared link lands on it.
 */
export default function AccountPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as Tab) : "profile";
  const select = (id: Tab) =>
    setParams(
      (p) => {
        if (id === "profile") p.delete("tab");
        else p.set("tab", id);
        return p;
      },
      { replace: true },
    );

  if (!user) return null; // RequireAuth guarantees a user; this keeps TypeScript honest
  return (
    <>
      <PageHeader title="Account" />
      <div className="mt-6 max-w-[880px] pb-10">
        <Tabs tabs={TABS} value={tab} onChange={select} />
        <div className="mt-5">
          {tab === "profile" && <ProfileCard user={user} />}
          {tab === "password" && <PasswordCard user={user} />}
          {tab === "sessions" && <SessionsCard />}
        </div>
      </div>
    </>
  );
}
