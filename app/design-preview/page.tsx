import { notFound } from "next/navigation";
import { DesignWorkspace } from "@/components/design-workspace";
import type { FlowPhase } from "@/lib/hunteragent-types";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "HunterAgent | Local design preview",
  robots: { index: false, follow: false },
};

export default async function DesignPreview({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { state } = await searchParams;
  const phase: FlowPhase =
    state === "onboarding" || state === "waiting" || state === "brief"
      ? state
      : "studio";
  return <DesignWorkspace key={phase} phase={phase} />;
}
