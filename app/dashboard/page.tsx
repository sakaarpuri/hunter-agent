import { AuthPanel } from "@/components/auth-panel";
import { ErrorBoundary } from "@/components/error-boundary";
import { HunterAgentFlow } from "@/components/hunteragent-flow";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    const { mode } = await searchParams;
    return <AuthPanel initialMode={mode === "signin" ? "signin" : "signup"} />;
  }

  return (
    <main>
      <div>
        <ErrorBoundary>
          <HunterAgentFlow user={user} />
        </ErrorBoundary>
      </div>
    </main>
  );
}
