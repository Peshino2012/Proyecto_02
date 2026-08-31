import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWebAuthnConfig, WEBAUTHN_CHALLENGE_COOKIE } from "@/lib/webauthn";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { rpID, rpName } = getWebAuthnConfig();

  const existing = await prisma.webAuthnCredential.findMany({
    where: { userId: session.user.id },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: session.user.id,
    userName: session.user.email ?? session.user.id,
    userDisplayName: session.user.name ?? session.user.email ?? "Vos",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
    excludeCredentials: existing.map((c) => ({
      id: isoBase64URL.toBuffer(c.credentialId),
      type: "public-key" as const,
      transports: c.transports ? (c.transports.split(",") as never) : undefined,
    })),
  });

  const cookieStore = await cookies();
  cookieStore.set(WEBAUTHN_CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/webauthn",
    maxAge: 120,
  });

  return NextResponse.json(options);
}
