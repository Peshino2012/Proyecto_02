import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiToken } from "@/lib/tokens";

const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tokens = await prisma.apiToken.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tokens });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createTokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  const { token, tokenHash } = generateApiToken();

  const created = await prisma.apiToken.create({
    data: { userId: session.user.id, name: parsed.data.name, tokenHash },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json({ token, apiToken: created }, { status: 201 });
}
