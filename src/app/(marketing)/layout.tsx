import type { ReactNode } from "react";
import { MarketingFooter } from "./_components/marketing-footer";
import { MarketingHeader } from "./_components/marketing-header";

/**
 * Chrome for the front door at `/`. Not the app's AppShell: that is a full-height
 * app frame with a thumb-reach tab bar, wrong for a scrolling marketing document.
 * Header + footer, everything else scrolls between them.
 *
 * A route group, so the landing can own `/` without this chrome leaking into the
 * driver app, the panels or the legal pages.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
