import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../features/auth/hooks/useAuth";

export default function ConsolePlaceholder({ title }: { title: string }) {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title={title} />
      <p className="mt-8 text-sm text-muted-warm">
        Signed in as{" "}
        <span className="text-strong">
          {user?.firstName} {user?.lastName}
        </span>{" "}
        ({user?.email}). This page is built in a later step.
      </p>
    </>
  );
}
