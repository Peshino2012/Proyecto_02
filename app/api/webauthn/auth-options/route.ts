import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWebAuthnConfig, WEBAUTHN_CHALLENGE_COOKIE } from "@/lib/webauthn";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { rpID } = getWebAuthnConfig();

  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId: session.user.id },
    select: { credentialId: true, transports: true },
  });

  if (credentials.length === 0) {
    return NextResponse.json({ error: "No hay ningún dispositivo registrado" }, { status: 400 });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: credentials.map((c) => ({
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
