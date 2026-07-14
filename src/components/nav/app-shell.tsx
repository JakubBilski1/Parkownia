"use client";

import {
  BarChart3,
  CalendarDays,
  Coins,
  LayoutGrid,
  Map,
  QrCode,
  Receipt,
  ShieldCheck,
  SquareParking,
  Ticket,
  User,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";
import { ROUTES } from "./routes";
import { UserMenu, type SessionUser } from "./user-menu";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const DRIVER_NAV: NavItem[] = [
  { href: ROUTES.map, label: "Mapa", icon: Map },
  { href: ROUTES.events, label: "Wydarzenia", icon: CalendarDays },
  { href: ROUTES.bookings, label: "Rezerwacje", icon: Ticket },
];

// The account screen (consent withdrawal, data export, deletion — RODO) is reached
// through the user menu on desktop. That menu lives in the top bar, which is hidden
// below 768 px, so on a phone the same screen needs its own way in: the fourth slot
// of the bottom bar, inside the thumb's reach. Signed out, it lands on the login
// screen with ?next=/konto — which is also the only sign-in entry point a phone has.
const ACCOUNT_NAV: NavItem = { href: ROUTES.account, label: "Konto", icon: User };

const HOST_NAV: NavItem[] = [
  { href: ROUTES.host.dashboard, label: "Pulpit", icon: LayoutGrid },
  { href: ROUTES.host.parkings, label: "Parkingi", icon: SquareParking },
  { href: ROUTES.host.scanner, label: "Skaner", icon: QrCode },
  { href: ROUTES.host.bookings, label: "Rezerwacje", icon: Ticket },
];

// The bottom bar holds four items and is full. Payouts is where a host finishes
// their Stripe verification — without it their parkings never go on sale — so it
// belongs in the shell, but it is a once-or-twice-ever destination, not a
// thumb-reach one. It goes in the secondary row next to the other things a host
// reads rather than does.
const HOST_SECONDARY: NavItem[] = [
  { href: ROUTES.host.events, label: "Wydarzenia", icon: CalendarDays },
  { href: ROUTES.host.payouts, label: "Wypłaty", icon: Wallet },
];

const ADMIN_NAV: NavItem[] = [
  { href: ROUTES.admin.dashboard, label: "Pulpit", icon: BarChart3 },
  { href: ROUTES.admin.moderation, label: "Moderacja", icon: ShieldCheck },
  { href: ROUTES.admin.events, label: "Wydarzenia", icon: CalendarDays },
  { href: ROUTES.admin.transactions, label: "Transakcje", icon: Receipt },
  { href: ROUTES.admin.payouts, label: "Wypłaty", icon: Wallet },
  { href: ROUTES.admin.commissions, label: "Prowizje", icon: Coins },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Wordmark({ href = ROUTES.map }: { href?: string }) {
  return (
    <Link
      href={href}
      className="rounded-button font-display text-h3 font-extrabold tracking-tight text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      ParkSpot
    </Link>
  );
}

/**
 * The primary actions sit at the bottom of a phone, inside the thumb's reach —
 * never in the top-right corner, which nobody can hit one-handed in the rain
 * (Fitts). On a desktop the same routes move into the top bar.
 */
function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Nawigacja główna"
      className="shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-touch flex-col items-center justify-center gap-1 px-1 py-2 text-ui",
                  "transition-colors duration-micro ease-out",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                  // Active is a neutral ink/muted contrast, not the accent: the
                  // accent belongs to the button that takes money.
                  active ? "font-semibold text-ink" : "text-muted",
                )}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TopBar({
  items,
  user,
  home,
}: {
  items: NavItem[];
  user?: SessionUser | null;
  home?: string;
}) {
  const pathname = usePathname();

  return (
    <header className="hidden shrink-0 items-center gap-6 border-b border-line bg-surface px-4 py-2 md:flex">
      <Wordmark href={home} />

      <nav aria-label="Nawigacja główna" className="flex-1">
        <ul className="flex items-center gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-touch items-center rounded-button px-3 text-ui",
                    "transition-colors duration-micro ease-out hover:bg-surface-2",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                    active ? "font-semibold text-ink" : "text-muted",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <ThemeToggle />
      <UserMenu user={user} />
    </header>
  );
}

export type AppShellProps = {
  children: React.ReactNode;
  /** Null when signed out; the shell then shows the signed-out bar. */
  user?: SessionUser | null;
};

export type DriverShellProps = AppShellProps & {
  /**
   * The map owns its viewport and must not scroll — the canvas fills the frame and
   * the sheet slides over it. Every other driver screen is a document and has to
   * scroll, or a list of events is a list of the first three events.
   */
  scroll?: boolean;
};

export function AppShell({ children, user, scroll = false }: DriverShellProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar items={DRIVER_NAV} user={user} />
      <main
        className={cn(
          "min-h-0 flex-1",
          scroll ? "overflow-y-auto" : "relative",
        )}
      >
        {children}
      </main>
      <BottomNav items={[...DRIVER_NAV, ACCOUNT_NAV]} />
    </div>
  );
}

export function HostShell({ children, user }: AppShellProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar
        items={[...HOST_NAV, ...HOST_SECONDARY]}
        user={user}
        home={ROUTES.host.dashboard}
      />
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      <BottomNav items={HOST_NAV} />
    </div>
  );
}

export function AdminShell({ children, user }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="shrink-0 border-b border-line bg-surface p-3 md:h-dvh md:w-60 md:border-b-0 md:border-r">
        <div className="mb-3 hidden md:block">
          <Wordmark href={ROUTES.admin.dashboard} />
          <p className="text-ui text-muted">Panel administratora</p>
        </div>

        <nav aria-label="Nawigacja panelu admina">
          <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {ADMIN_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-touch shrink-0 items-center gap-2 rounded-button px-3 text-ui",
                      "transition-colors duration-micro ease-out hover:bg-surface-2",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                      active
                        ? "bg-selected text-selected-ink"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-3 hidden flex-col items-start gap-2 md:flex">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4">{children}</main>
    </div>
  );
}
