import { NextRequest, NextResponse } from "next/server";
import { deviceAlarms, ensureDeviceTopic, userIdFromBearer } from "@/lib/device-alarms";

export const runtime = "nodejs";

// Lo consulta la app de Android de alarmas al abrirse, cuando el calendario le avisa que algo
// cambió y cada ~15 minutos, con el token de
// Ajustes → Tokens API (el mismo tipo de token que usa el conector MCP).
export async function GET(req: NextRequest) {
  const userId = await userIdFromBearer(req.headers.get("authorization"));
  if (!userId) {
    return NextResponse.json({ error: "Token inválido o ausente" }, { status: 401 });
  }

  const [alarms, topic] = await Promise.all([deviceAlarms(userId), ensureDeviceTopic(userId)]);
  // topic: canal de ntfy.sh por el que el calendario le avisa a la app que algo cambió.
  return NextResponse.json({ alarms, topic, generatedAt: new Date().toISOString() });
}
