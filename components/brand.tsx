import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="HunterAgent home">
      <span className="brand-symbol" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      {!compact && (
        <span>
          hunter<span className="brand-agent">agent</span>
          <span className="brand-period">.</span>
        </span>
      )}
    </Link>
  );
}
