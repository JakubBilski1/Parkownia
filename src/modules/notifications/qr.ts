import QRCode from "qrcode";
import { putObject } from "@/lib/s3";

/**
 * The booking QR used to ride along as an inline attachment. The mail API
 * (pbdevs) carries no attachments, so the PNG goes to object storage and the
 * template embeds it by URL: <img src="{{qrUrl}}">.
 *
 * Resilient on purpose. The confirmation mail is the product — it carries the
 * code a driver shows at the barrier — and it must go out even if object storage
 * is momentarily unreachable or unconfigured (as in the test environment). On
 * failure we log, return null, and the mail still sends: the code is in the body
 * as text, the template hides the image, and the host can type the code by hand.
 */
export async function bookingQrUrl(code: string): Promise<string | null> {
  try {
    const png = await QRCode.toBuffer(code, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 8,
      color: { dark: "#191A1C", light: "#FFFFFF" },
    });
    return await putObject(`qr/${code}.png`, png, "image/png");
  } catch (error) {
    console.warn(
      `[notifications] booking QR upload failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return null;
  }
}
