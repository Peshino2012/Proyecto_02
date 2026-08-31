import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
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
  if (!body?.id) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const credential = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: body.id },
  });
  if (!credential || credential.userId !== session.user.id) {
    return NextResponse.json({ error: "Dispositivo no reconocido" }, { status: 400 });
  }

  const { rpID, origin } = getWebAuthnConfig();

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: isoBase64URL.toBuffer(credential.credentialId),
        credentialPublicKey: new Uint8Array(credential.publicKey),
        counter: Number(credential.counter),
        transports: credential.transports
          ? (credential.transports.split(",") as never)
          : undefined,
      },
    });
  } catch (err) {
    console.error("[webauthn] auth-verify falló", err);
    return NextResponse.json({ error: "No se pudo verificar" }, { status: 400 });
  }

  cookieStore.delete(WEBAUTHN_CHALLENGE_COOKIE);

  if (!verification.verified) {
    return NextResponse.json({ error: "No se pudo verificar" }, { status: 400 });
  }

  await prisma.webAuthnCredential.update({
    where: { id: credential.id },
    data: { counter: BigInt(verification.authenticationInfo.newCounter) },
  });

  return NextResponse.json({ ok: true });
}
