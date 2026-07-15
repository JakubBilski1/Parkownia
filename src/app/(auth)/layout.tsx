import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 p-4">
        <Link
          href="/"
          className="rounded-button font-display text-h3 font-extrabold tracking-tight text-ink"
        >
          Parkownia
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-[27rem] flex-1 flex-col justify-center px-4 pb-10 pt-2">
        {children}
      </main>
    </div>
  );
}
