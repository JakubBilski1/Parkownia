import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const display = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ParkSpot — parking na mecz i targi w Poznaniu",
    template: "%s · ParkSpot",
  },
  description:
    "Zarezerwuj miejsce parkingowe przy Enea Stadionie i MTP. Płacisz z góry, wjeżdżasz na kod.",
  applicationName: "ParkSpot",
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: "ParkSpot",
    title: "ParkSpot — parking na mecz i targi w Poznaniu",
    description:
      "Zarezerwuj miejsce parkingowe przy Enea Stadionie i MTP. Płacisz z góry, wjeżdżasz na kod.",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eeeeeb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1918" },
  ],
};

/**
 * Runs before first paint: without it the page flashes light before the stored
 * preference is read. Kept as a raw string so it ships inline, not as a chunk.
 */
const themeScript = `(function(){try{var t=localStorage.getItem("parkspot-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pl"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg font-body text-body text-ink antialiased">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
