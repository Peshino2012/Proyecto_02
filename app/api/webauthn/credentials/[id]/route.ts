import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const credential = await prisma.webAuthnCredential.findUnique({ where: { id } });
  if (!credential || credential.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.webAuthnCredential.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
