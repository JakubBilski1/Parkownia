import type { ReactNode } from "react";
import { MarketingFooter } from "./_components/marketing-footer";
import { MarketingHeader } from "./_components/marketing-header";

/**
 * The owners' landing gets its own chrome, not the app's AppShell: AppShell is a
 * full-height app frame with a thumb-reach tab bar, wrong for a scrolling marketing
 * document. Header + footer, everything else scrolls between them.
 */
export default function DlaWlascicieliLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
