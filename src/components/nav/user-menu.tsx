"use client";

import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ROUTES } from "./routes";

export type SessionUser = {
  firstName?: string | null;
  email: string;
  isHost?: boolean;
  isAdmin?: boolean;
  /** A client's staff member: the gate and the bookings list, nothing else. */
  isEmployee?: boolean;
};

export type UserMenuProps = {
  user?: SessionUser | null;
  className?: string;
};

export function UserMenu({ user, className }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) {
    return (
      <Button
        variant="quiet"
        size="sm"
        className={className}
        onClick={() => router.push(ROUTES.login)}
      >
        Zaloguj się
      </Button>
    );
  }

  const label = user.firstName?.trim() || user.email;

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(
      () => {
        // A failed logout still clears the local view; the server token expires.
      },
    );
    setOpen(false);
    router.refresh();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "press inline-flex min-h-touch items-center gap-2 rounded-pill border border-line bg-surface px-3 text-ui font-semibold text-ink",
          "transition-colors duration-micro ease-out hover:bg-surface-2",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        )}
      >
        <User size={18} aria-hidden="true" />
        <span className="max-w-[10rem] truncate">{label}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 flex w-56 flex-col rounded-card border border-line bg-surface p-1 shadow-float"
        >
          <MenuLink href={ROUTES.bookings} onNavigate={() => setOpen(false)}>
            Moje rezerwacje
          </MenuLink>
          <MenuLink href={ROUTES.account} onNavigate={() => setOpen(false)}>
            Konto
          </MenuLink>
          <MenuLink
            href={user.isHost ? ROUTES.host.dashboard : ROUTES.becomeHost}
            onNavigate={() => setOpen(false)}
          >
            {user.isHost ? "Panel hosta" : "Udostępnij swoje miejsce"}
          </MenuLink>
          {user.isAdmin ? (
            <MenuLink href={ROUTES.admin.dashboard} onNavigate={() => setOpen(false)}>
              Panel admina
            </MenuLink>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className={cn(
              "mt-1 inline-flex min-h-touch items-center gap-2 rounded-button border-t border-line px-3 text-left text-ui text-ink",
              "transition-colors duration-micro ease-out hover:bg-surface-2",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            )}
          >
            <LogOut size={16} aria-hidden="true" />
            Wyloguj się
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className={cn(
        "inline-flex min-h-touch items-center rounded-button px-3 text-ui text-ink",
        "transition-colors duration-micro ease-out hover:bg-surface-2",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      )}
    >
      {children}
    </Link>
  );
}
