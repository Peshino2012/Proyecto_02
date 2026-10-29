import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { workCounts } from "@/lib/work";

// Contadores del apartado Trabajo para el número del botón "Trabajo".
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const counts = await workCounts(session.user.id);
  return NextResponse.json(counts);
}
