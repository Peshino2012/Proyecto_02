import { NextRequest, NextResponse } from "next/server";
import { deviceAlarms, userIdFromBearer } from "@/lib/device-alarms";

export const runtime = "nodejs";

// Lo consulta la app de Android de alarmas cada ~15 minutos, con el token de
// Ajustes → Tokens API (el mismo tipo de token que usa el conector MCP).
export async function GET(req: NextRequest) {
  const userId = await userIdFromBearer(req.headers.get("authorization"));
  if (!userId) {
    return NextResponse.json({ error: "Token inválido o ausente" }, { status: 401 });
  }

  const alarms = await deviceAlarms(userId);
  return NextResponse.json({ alarms, generatedAt: new Date().toISOString() });
}
