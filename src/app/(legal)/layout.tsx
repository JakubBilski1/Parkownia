import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageContainer } from "@/components/ui";

/**
 * Chrome for the legal pages (/prywatnosc, /regulamin). Linked from both the
 * owners' landing footer and the driver registration form, so it is deliberately
 * neutral — not the marketing shell. Prose width for a real reading measure.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-line bg-bg">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 lg:px-6">
          <Link
            href="/"
            className="rounded-button font-display text-h3 font-extrabold tracking-tight text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Parkownia
          </Link>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 py-12">
        <PageContainer width="prose">{children}</PageContainer>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 text-ui text-muted lg:px-6">
          <nav aria-label="Dokumenty" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/prywatnosc" className="underline underline-offset-4 hover:text-ink">
              Polityka prywatności
            </Link>
            <Link href="/regulamin" className="underline underline-offset-4 hover:text-ink">
              Regulamin
            </Link>
            <Link href="/" className="underline underline-offset-4 hover:text-ink">
              Dla właścicieli
            </Link>
            <a
              href="mailto:kontakt@parkownia.com"
              className="underline underline-offset-4 hover:text-ink"
            >
              kontakt@parkownia.com
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
