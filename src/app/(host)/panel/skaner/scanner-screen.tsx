"use client";

import {
  AlertTriangle,
  CloudOff,
  Download,
  Keyboard,
  RefreshCw,
  ScanLine,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  enqueueScan,
  findAdmission,
  getDeviceId,
  getManifest,
  listManifests,
  markManifestEntryUsed,
  pendingCount,
  recordAdmission,
  saveManifest,
} from "@/lib/offline/db";
import { startAutoSync, syncPending } from "@/lib/offline/sync";
import { formatCodes, formatDatePL, formatDateTimePL, formatTimePL } from "@/lib/format";
import { hashBookingCode, looksLikeBookingCode, normalizeBookingCode } from "@/modules/scan/hash";
import { verifyAgainstManifest } from "@/modules/scan/offline-verify";
import {
  MANIFEST_STALE_AFTER_MS,
  type ScanManifest,
  type ScanSource,
  type ScanVerdict,
} from "@/modules/scan/types";
import { barcodeDetectorSupported, createQrDetector, detectQr } from "./barcode";
import { ManualEntry } from "./manual-entry";
import { OptionButton } from "./option-button";
import { VerdictOverlay, type GateState } from "./verdict-overlay";

type HostEvent = {
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
};

const EVENT_KEY = "parkspot-scan-event";
const PARKING_KEY = "parkspot-scan-parking";
const DETECT_INTERVAL_MS = 220;

export function ScannerScreen({ initialEventId }: { initialEventId?: string }) {
  const { toast } = useToast();

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [manifests, setManifests] = useState<ScanManifest[]>([]);
  const [eventId, setEventId] = useState<string | null>(initialEventId ?? null);
  const [parkingId, setParkingId] = useState<string | null>(null);
  const [events, setEvents] = useState<HostEvent[]>([]);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [gate, setGate] = useState<GateState | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [camera, setCamera] = useState<"idle" | "running" | "denied" | "unsupported">("idle");
  const [checking, setChecking] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<{ hash: string; at: number } | null>(null);

  const manifest = useMemo(
    () => manifests.find((item) => item.eventId === eventId) ?? null,
    [manifests, eventId],
  );

  const parking = useMemo(
    () => manifest?.parkings.find((item) => item.id === parkingId) ?? null,
    [manifest, parkingId],
  );

  const manifestAgeMs = manifest ? Date.now() - Date.parse(manifest.generatedAt) : null;
  const manifestStale = manifestAgeMs !== null && manifestAgeMs > MANIFEST_STALE_AFTER_MS;

  /* ---------------------------------------------------------------- bootstrap */

  useEffect(() => {
    let alive = true;

    void (async () => {
      const [id, stored, count] = await Promise.all([
        getDeviceId(),
        listManifests(),
        pendingCount(),
      ]);
      if (!alive) return;

      setDeviceId(id);
      setManifests(stored);
      setPending(count);

      const savedEvent = initialEventId ?? localStorage.getItem(EVENT_KEY);
      const active =
        stored.find((item) => item.eventId === savedEvent) ??
        stored.find((item) => Date.parse(item.eventEndsAt) > Date.now()) ??
        null;

      if (active) {
        setEventId(active.eventId);
        const savedParking = localStorage.getItem(PARKING_KEY);
        const chosen =
          active.parkings.find((item) => item.id === savedParking) ?? active.parkings[0] ?? null;
        setParkingId(chosen?.id ?? null);
      }
    })();

    if (!barcodeDetectorSupported()) setCamera("unsupported");

    return () => {
      alive = false;
    };
  }, [initialEventId]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    return startAutoSync({
      onPendingChange: setPending,
      onReport: (report) => {
        if (report.sent === 0) return;
        if (report.conflicts.length === 0) {
          toast({ tone: "ok", message: `Zsynchronizowano ${report.sent} skanów.` });
          return;
        }
        toast({
          tone: "error",
          message: `${report.conflicts.length} z ${report.sent} skanów wymaga wyjaśnienia.`,
          detail:
            "Ten sam kod wjechał na dwóch urządzeniach albo rezerwacja była nieważna. Szczegóły w rezerwacjach.",
        });
      },
    });
  }, [toast]);

  useEffect(() => {
    if (!online) return;
    void (async () => {
      try {
        const response = await fetch("/api/scan/manifest", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { items: HostEvent[] };
        setEvents(payload.items ?? []);
      } catch {
        // Offline again already. The stored manifests are what matters.
      }
    })();
  }, [online]);

  /* ------------------------------------------------------------------- camera */

  const ready = Boolean(manifest && parkingId && deviceId);
  const scanning = ready && gate === null && !manualOpen;

  useEffect(() => {
    if (!scanning || camera === "unsupported") return;

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    void (async () => {
      const detector = await createQrDetector();
      if (!detector) {
        setCamera("unsupported");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        if (!cancelled) setCamera("denied");
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setCamera("running");

      timer = setInterval(() => {
        void (async () => {
          if (busyRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
          const raw = await detectQr(detector, videoRef.current);
          if (raw) await handleCode(raw, "CAMERA");
        })();
      }, DETECT_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // handleCode is stable enough for this loop: it reads refs and state setters only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, camera, manifest, parkingId, deviceId, online]);

  /* -------------------------------------------------------------------- scans */

  const handleCode = useCallback(
    async (raw: string, source: ScanSource) => {
      if (busyRef.current) return;
      if (!manifest || !parkingId || !deviceId) return;

      const code = normalizeBookingCode(raw);
      if (!looksLikeBookingCode(code)) return;

      const codeHash = await hashBookingCode(code);

      // The same QR sits in front of the lens for several frames. One verdict, not ten.
      const last = lastCodeRef.current;
      if (last && last.hash === codeHash && Date.now() - last.at < 3000) return;

      busyRef.current = true;
      lastCodeRef.current = { hash: codeHash, at: Date.now() };
      setChecking(true);

      try {
        const verdict = await resolve({ code, codeHash, source, parkingId, deviceId, manifest });

        if (!verdict) {
          vibrate(false);
          setGate({ kind: "unverifiable" });
          return;
        }

        vibrate(verdict.result === "ADMITTED");
        setGate({ kind: "verdict", verdict, queued: verdict.offline });

        if (verdict.offline) {
          await enqueueScan({
            eventId: manifest.eventId,
            parkingId,
            codeHash,
            scannedAt: new Date().toISOString(),
            result: verdict.result,
            reason: verdict.reason,
            source,
            deviceId,
          });

          if (verdict.result === "ADMITTED") {
            await recordAdmission({
              codeHash,
              eventId: manifest.eventId,
              scannedAt: new Date().toISOString(),
            });
            await markManifestEntryUsed(manifest.eventId, codeHash);
            const refreshed = await getManifest(manifest.eventId);
            if (refreshed) {
              setManifests((current) =>
                current.map((item) => (item.eventId === refreshed.eventId ? refreshed : item)),
              );
            }
          }

          setPending(await pendingCount());
          void syncPending().catch(() => undefined);
        }
      } finally {
        setChecking(false);
        busyRef.current = false;
      }
    },
    [manifest, parkingId, deviceId],
  );

  /* ---------------------------------------------------------------- manifests */

  const download = useCallback(
    async (targetEventId: string) => {
      setDownloading(targetEventId);
      try {
        const response = await fetch(`/api/scan/manifest?eventId=${targetEventId}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          toast({
            tone: "error",
            message: "Nie pobrałem kodów.",
            detail: "Serwer nie odpowiedział poprawnie. Spróbuj ponownie, zanim staniesz przy bramie.",
          });
          return;
        }

        const fresh = (await response.json()) as ScanManifest;
        await saveManifest(fresh);
        const stored = await listManifests();
        setManifests(stored);
        setEventId(fresh.eventId);
        localStorage.setItem(EVENT_KEY, fresh.eventId);

        const chosen = fresh.parkings[0];
        if (chosen && !fresh.parkings.some((item) => item.id === parkingId)) {
          setParkingId(chosen.id);
          localStorage.setItem(PARKING_KEY, chosen.id);
        }

        toast({
          tone: "ok",
          message: `Kody pobrane: ${fresh.entries.length}.`,
          detail: "Skaner zadziała teraz bez sieci.",
        });
      } catch {
        toast({
          tone: "error",
          message: "Nie pobrałem kodów.",
          detail: "Brak sieci. Znajdź zasięg i pobierz je, zanim event się zacznie.",
        });
      } finally {
        setDownloading(null);
      }
    },
    [parkingId, toast],
  );

  const chooseParking = useCallback((id: string) => {
    setParkingId(id);
    localStorage.setItem(PARKING_KEY, id);
  }, []);

  const chooseEvent = useCallback(
    (id: string) => {
      setEventId(id);
      localStorage.setItem(EVENT_KEY, id);
      const target = manifests.find((item) => item.eventId === id);
      const first = target?.parkings[0];
      if (first) chooseParking(first.id);
    },
    [manifests, chooseParking],
  );

  /* --------------------------------------------------------------------- view */

  if (!ready) {
    return (
      <Setup
        events={events}
        manifests={manifests}
        online={online}
        downloading={downloading}
        onDownload={download}
        onChooseEvent={chooseEvent}
        onChooseParking={chooseParking}
        eventId={eventId}
        parkingId={parkingId}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0d0d0d]">
      {/* The stage behind the camera is intentionally near-black in both themes:
          it is a viewport, not a surface, and letterboxing must not glow. */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <ScanFrame active={camera === "running"} />
      </div>

      {checking ? (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-0 bottom-32 z-10 mx-auto w-fit rounded-pill border border-line bg-surface px-4 py-2 text-ui font-semibold text-ink"
        >
          Sprawdzam kod…
        </p>
      ) : null}

      <StatusStrip
        online={online}
        pending={pending}
        stale={manifestStale}
        gateName={parking?.title ?? "Wybierz bramę"}
        eventTitle={manifest?.eventTitle ?? ""}
        codes={manifest?.entries.length ?? 0}
        onSync={() => void syncPending().catch(() => undefined)}
      />

      {camera !== "running" ? (
        <div className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-4">
          <div className="mx-auto max-w-[28rem] rounded-card border border-line bg-surface p-4">
            <p className="text-body font-semibold text-ink">
              {camera === "denied"
                ? "Nie mam dostępu do kamery."
                : camera === "unsupported"
                  ? "Ta przeglądarka nie czyta kodów QR."
                  : "Uruchamiam kamerę…"}
            </p>
            {camera !== "idle" ? (
              <p className="mt-1 text-ui text-muted">
                Skanuj ręcznie — wpisz kod z ekranu kierowcy. Bramę obsłużysz bez kamery.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {manifestStale && online ? (
          <Button
            variant="quiet"
            block
            size="lg"
            onClick={() => manifest && void download(manifest.eventId)}
            loading={downloading === manifest?.eventId}
          >
            Kody sprzed ponad doby — pobierz ponownie
          </Button>
        ) : null}

        <Button variant="accent" block size="lg" onClick={() => setManualOpen(true)}>
          <Keyboard size={20} aria-hidden="true" />
          Wpisz kod ręcznie
        </Button>
      </div>

      <ManualEntry
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        parkings={manifest?.parkings ?? []}
        parkingId={parkingId}
        onChooseParking={chooseParking}
        onSubmit={async (code) => {
          setManualOpen(false);
          await handleCode(code, "MANUAL");
        }}
      />

      {gate ? <VerdictOverlay state={gate} onDismiss={() => setGate(null)} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ resolving */

/**
 * Online first (the server is the only source of truth about a cancellation
 * made ten minutes ago), offline as the fallback that must never fail. Returns
 * null only when neither path can answer — and then the screen says so.
 */
async function resolve({
  code,
  codeHash,
  source,
  parkingId,
  deviceId,
  manifest,
}: {
  code: string;
  codeHash: string;
  source: ScanSource;
  parkingId: string;
  deviceId: string;
  manifest: ScanManifest;
}): Promise<ScanVerdict | null> {
  if (navigator.onLine) {
    try {
      const endpoint = source === "MANUAL" ? "/api/scan/manual" : "/api/scan/validate";
      const body =
        source === "MANUAL" ? { code, parkingId, deviceId } : { codeHash, parkingId, deviceId };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (response.ok) {
        return (await response.json()) as ScanVerdict;
      }
    } catch {
      // The cell tower at the stadium just died. Carry on offline.
    }
  }

  const admission = await findAdmission(codeHash);

  return verifyAgainstManifest({
    manifest,
    codeHash,
    parkingId,
    now: new Date(),
    locallyAdmittedAt: admission?.scannedAt ?? null,
  });
}

function vibrate(admitted: boolean) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  // The host is looking at the car, not at the phone. One buzz: in. Three: stop.
  navigator.vibrate(admitted ? 60 : [90, 70, 90, 70, 90]);
}

/* ----------------------------------------------------------------- fragments */

function ScanFrame({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-[62vw] max-h-[20rem] w-[62vw] max-w-[20rem] opacity-90"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke={active ? "#FFFFFF" : "#9E978D"}
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M4 22 V8 a4 4 0 0 1 4-4 h14" />
        <path d="M78 4 h14 a4 4 0 0 1 4 4 v14" />
        <path d="M96 78 v14 a4 4 0 0 1-4 4 h-14" />
        <path d="M22 96 H8 a4 4 0 0 1-4-4 V78" />
      </g>
    </svg>
  );
}

function StatusStrip({
  online,
  pending,
  stale,
  gateName,
  eventTitle,
  codes,
  onSync,
}: {
  online: boolean;
  pending: number;
  stale: boolean;
  gateName: string;
  eventTitle: string;
  codes: number;
  onSync: () => void;
}) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface px-3 py-2">
        <span className="flex items-center gap-1.5 text-ui font-semibold text-ink">
          {online ? (
            <Wifi size={16} aria-hidden="true" />
          ) : (
            <CloudOff size={16} aria-hidden="true" className="text-danger" />
          )}
          {online ? "Sieć jest" : "Brak sieci"}
        </span>

        <span className="num text-ui text-muted">{formatCodes(codes)}</span>

        {pending > 0 ? (
          <button
            type="button"
            onClick={onSync}
            className="inline-flex min-h-touch items-center gap-1.5 rounded-chip px-2 text-ui font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span className="num">{pending}</span> do wysłania
          </button>
        ) : null}

        {stale ? (
          <span className="flex items-center gap-1.5 text-ui font-semibold text-danger">
            <AlertTriangle size={16} aria-hidden="true" />
            Kody sprzed doby
          </span>
        ) : null}

        <span className="w-full truncate text-ui text-muted">
          {gateName} · {eventTitle}
        </span>
      </div>
    </div>
  );
}

function Setup({
  events,
  manifests,
  online,
  downloading,
  eventId,
  parkingId,
  onDownload,
  onChooseEvent,
  onChooseParking,
}: {
  events: HostEvent[];
  manifests: ScanManifest[];
  online: boolean;
  downloading: string | null;
  eventId: string | null;
  parkingId: string | null;
  onDownload: (eventId: string) => void;
  onChooseEvent: (eventId: string) => void;
  onChooseParking: (parkingId: string) => void;
}) {
  const manifest = manifests.find((item) => item.eventId === eventId) ?? null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[32rem] flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h2 font-bold text-ink">Skaner</h1>
        <p className="text-ui text-muted">
          Pobierz kody na event, zanim pojedziesz pod bramę. Przy stadionie sieci nie będzie.
        </p>
      </header>

      {manifest && manifest.parkings.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-ui font-semibold text-ink">Przy której bramie stoisz?</h2>
          {manifest.parkings.map((item) => (
            <OptionButton
              key={item.id}
              selected={item.id === parkingId}
              onClick={() => onChooseParking(item.id)}
            >
              <span className="text-body font-semibold">{item.title}</span>
            </OptionButton>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-ui font-semibold text-ink">Pobrane kody</h2>

        {manifests.length === 0 ? (
          <EmptyState
            icon={ScanLine}
            title="Nie masz jeszcze kodów na żaden event"
            description="Skaner działa bez internetu tylko wtedy, gdy kody są w telefonie. Pobierz je w domu, przy Wi-Fi — przy bramie będzie za późno."
          />
        ) : (
          manifests.map((item) => (
            <OptionButton
              key={item.eventId}
              selected={item.eventId === eventId}
              onClick={() => onChooseEvent(item.eventId)}
            >
              <span className="text-body font-semibold">{item.eventTitle}</span>
              <span className="num text-ui opacity-80">
                {formatDatePL(item.eventStartsAt)}, {formatTimePL(item.eventStartsAt)} ·{" "}
                {formatCodes(item.entries.length)} · pobrane {formatDateTimePL(item.generatedAt)}
              </span>
            </OptionButton>
          ))
        )}
      </section>

      {online ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-ui font-semibold text-ink">Nadchodzące eventy</h2>
          {events.length === 0 ? (
            <p className="text-ui text-muted">
              Nie udostępniłeś parkingu na żaden nadchodzący event. Zrób to w panelu — inaczej nie
              ma czego skanować.
            </p>
          ) : (
            events.map((item) => (
              <div
                key={item.eventId}
                className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-ink">{item.title}</p>
                  <p className="num text-ui text-muted">
                    {formatDatePL(item.startsAt)}, {formatTimePL(item.startsAt)}
                  </p>
                </div>
                <Button
                  variant="quiet"
                  onClick={() => onDownload(item.eventId)}
                  loading={downloading === item.eventId}
                >
                  <Download size={18} aria-hidden="true" />
                  Pobierz
                </Button>
              </div>
            ))
          )}
        </section>
      ) : (
        <p className="flex items-center gap-2 text-ui text-danger">
          <CloudOff size={16} aria-hidden="true" />
          Brak sieci. Nowych kodów teraz nie pobierzesz.
        </p>
      )}
    </div>
  );
}
