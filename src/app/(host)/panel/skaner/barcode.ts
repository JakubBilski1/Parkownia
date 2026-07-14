"use client";

/**
 * BarcodeDetector is not in the TypeScript DOM lib and is not in every browser
 * (Safari on iOS has no support at the time of writing). The scanner therefore
 * treats the camera as an accelerator, never as a requirement: when this file
 * returns null, the manual code entry is the scanner.
 */

type DetectedBarcode = { rawValue: string };

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

function constructor(): BarcodeDetectorConstructor | null {
  const candidate = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector;
  return typeof candidate === "function" ? candidate : null;
}

export function barcodeDetectorSupported(): boolean {
  return constructor() !== null;
}

export async function createQrDetector(): Promise<BarcodeDetectorLike | null> {
  const Detector = constructor();
  if (!Detector) return null;

  try {
    const formats = (await Detector.getSupportedFormats?.()) ?? ["qr_code"];
    if (!formats.includes("qr_code")) return null;
    return new Detector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

export async function detectQr(
  detector: BarcodeDetectorLike,
  video: HTMLVideoElement,
): Promise<string | null> {
  try {
    const found = await detector.detect(video);
    return found[0]?.rawValue ?? null;
  } catch {
    // A frame the decoder chokes on is not an error the host needs to see.
    return null;
  }
}
