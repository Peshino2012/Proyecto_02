import { randomBytes, createHash } from "crypto";

const TOKEN_PREFIX = "cal_";

export function generateApiToken(): { token: string; tokenHash: string } {
  const raw = randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}${raw}`;
  return { token, tokenHash: hashApiToken(token) };
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
