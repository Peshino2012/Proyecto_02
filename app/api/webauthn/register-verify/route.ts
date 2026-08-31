import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWebAuthnConfig, WEBAUTHN_CHALLENGE_COOKIE } from "@/lib/webauthn";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get(WEBAUTHN_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: "El desafío expiró, probá de nuevo" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { rpID, origin } = getWebAuthnConfig();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (err) {
    console.error("[webauthn] register-verify falló", err);
    return NextResponse.json({ error: "No se pudo verificar el dispositivo" }, { status: 400 });
  }

  cookieStore.delete(WEBAUTHN_CHALLENGE_COOKIE);

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "No se pudo verificar el dispositivo" }, { status: 400 });
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

  await prisma.webAuthnCredential.create({
    data: {
      userId: session.user.id,
      credentialId: isoBase64URL.fromBuffer(credentialID),
      publicKey: Buffer.from(credentialPublicKey),
      counter: BigInt(counter),
      transports: Array.isArray(body.response?.transports)
        ? body.response.transports.join(",")
        : null,
      deviceLabel: body.deviceLabel ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
