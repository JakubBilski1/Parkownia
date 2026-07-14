import QRCode from "qrcode";

/**
 * The QR payload is the booking code itself — nothing else. The scanner hashes
 * what it decodes and looks the hash up in its offline manifest, so a longer
 * payload (URL, JSON) would only shrink the modules and make the code harder to
 * read on a cracked screen at night.
 *
 * Colours are hard black on hard white in BOTH themes, on purpose: a QR rendered
 * in brand ink on brand surface loses contrast and stops scanning. This is the
 * one surface where the design tokens do not apply, and it is a functional
 * decision, not an oversight.
 */
const QR_OPTIONS = {
  errorCorrectionLevel: "M",
  margin: 2,
  scale: 8,
  color: { dark: "#000000ff", light: "#ffffffff" },
} as const;

export async function renderBookingQrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, QR_OPTIONS);
}

/** SVG variant — used by the confirmation e-mail, where a data URL is often stripped. */
export async function renderBookingQrSvg(code: string): Promise<string> {
  return QRCode.toString(code, { ...QR_OPTIONS, type: "svg" });
}
