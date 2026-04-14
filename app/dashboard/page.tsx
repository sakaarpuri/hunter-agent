import { AuthPanel } from "@/components/auth-panel";
import { ErrorBoundary } from "@/components/error-boundary";
import { HunterAgentFlow } from "@/components/hunteragent-flow";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthPanel />;
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <ErrorBoundary>
          <HunterAgentFlow user={user} />
        </ErrorBoundary>
      </div>
    </main>
  );
}
