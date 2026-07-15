import { NextResponse } from "next/server";
import { handler, invalidInput } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { consumeActionToken, issueActionToken } from "@/modules/auth/action-tokens";
import { sendActionLink } from "@/modules/auth/mailer";
import { exportUserData, getProfile } from "@/modules/users/service";

/**
 * The export is not built here and stored somewhere — it is regenerated when
 * the link is opened. A JSON dump of somebody's bookings sitting on disk for
 * 24 hours is a liability we do not need to take on.
 */
export const POST = handler({
  handle: async ({ req }) => {
    const session = await requireUser(req);
    await enforceRateLimit(`export:${session.userId}`, 3, 60 * 60);

    const profile = await getProfile(session.userId);
    const { id, token, expiresAt } = await issueActionToken({
      userId: session.userId,
      purpose: "DATA_EXPORT",
    });

    await sendActionLink({
      userId: session.userId,
      to: profile.email,
      template: "data_export",
      tokenId: id,
      token,
      expiresAt,
      firstName: profile.firstName,
    });

    return {
      ok: true,
      expiresAt,
      message: "Link do pobrania danych wysłaliśmy na Twój adres e-mail. Jest ważny 24 godziny.",
    };
  },
});

/** Opened from the e-mail link; the token is the authorisation, and it burns on use. */
export const GET = handler({
  handle: async ({ req }) => {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      throw invalidInput("Brakuje tokenu z linku.", "TOKEN_INVALID");
    }

    const { userId } = await consumeActionToken("DATA_EXPORT", token);
    const data = await exportUserData(userId);

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="parkownia-moje-dane.json"',
        "Cache-Control": "no-store",
      },
    });
  },
});
