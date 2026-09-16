import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import styles from "@/components/legal-document.module.css";

type LegalDocumentProps = {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  children: ReactNode;
};

function configuredSupportEmail() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function LegalContact() {
  const email = configuredSupportEmail();

  if (email) {
    return (
      <a href={`mailto:${email}`} className={styles.contactLink}>
        {email}
      </a>
    );
  }

  return (
    <span>HunterAgent support</span>
  );
}

export function LegalDocument({
  eyebrow,
  title,
  summary,
  updated,
  children,
}: LegalDocumentProps) {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#legal-content">
        Skip to legal content
      </a>
      <header className={styles.header}>
        <Brand />
        <Link href="/" className={styles.homeLink}>
          Back to home
        </Link>
      </header>
      <main id="legal-content" className={styles.main}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p className={styles.summary}>{summary}</p>
          <p className={styles.updated}>Last updated: {updated}</p>
        </header>
        <article className={styles.document}>{children}</article>
      </main>
      <footer className={styles.footer}>
        <p>HunterAgent</p>
        <nav aria-label="Legal pages">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
