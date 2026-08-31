// Deriva rpID (dominio, sin protocolo/puerto) y origin (URL completa) de
// NEXTAUTH_URL, para no hardcodear el dominio entre desarrollo local y
// producción.
export function getWebAuthnConfig() {
  const url = new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000");
  return {
    rpID: url.hostname,
    rpName: "Calendario",
    origin: url.origin,
  };
}

export const WEBAUTHN_CHALLENGE_COOKIE = "webauthn_challenge";
