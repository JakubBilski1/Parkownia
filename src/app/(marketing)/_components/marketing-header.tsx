import Link from "next/link";
import { ROUTES } from "@/components/nav/routes";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 lg:px-6">
        <Link
          href="/"
          className="rounded-button font-display text-h3 font-extrabold tracking-tight text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Parkownia
        </Link>
        <div className="flex-1" />
        {/* Hidden on the narrowest screens: the hero carries the same link in prose,
            and a three-item header wraps on a phone. */}
        <Link
          href={ROUTES.map}
          className="hidden min-h-touch items-center rounded-button px-3 text-ui text-muted transition-colors duration-micro ease-out hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:inline-flex"
        >
          Mapa parkingów
        </Link>
        <ThemeToggle />
        <Link href="/logowanie" className={buttonVariants({ variant: "quiet", size: "sm" })}>
          Zaloguj
        </Link>
      </div>
    </header>
  );
}
