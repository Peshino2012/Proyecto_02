import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [user, credentials] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { requireBiometricAppLock: true },
    }),
    prisma.webAuthnCredential.findMany({
      where: { userId: session.user.id },
      select: { id: true, deviceLabel: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    requireBiometricAppLock: user?.requireBiometricAppLock ?? false,
    credentials,
  });
}

const patchSchema = z.object({ requireBiometricAppLock: z.boolean() });

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (parsed.data.requireBiometricAppLock) {
    const count = await prisma.webAuthnCredential.count({ where: { userId: session.user.id } });
    if (count === 0) {
      return NextResponse.json(
        { error: "Registrá primero un dispositivo" },
        { status: 400 }
      );
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { requireBiometricAppLock: parsed.data.requireBiometricAppLock },
  });

  return NextResponse.json({ ok: true });
}
