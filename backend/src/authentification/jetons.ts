import { createHash, randomBytes, randomInt } from "node:crypto";

export function genererJetonSession(): string {
  return randomBytes(32).toString("base64url");
}

export function hacherJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

export function genererCodeReinitialisation(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function dateDansMinutes(minutes: number, maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() + minutes * 60_000);
}

export function lireEntierPositif(valeur: string | undefined, valeurParDefaut: number): number {
  const nombre = Number(valeur);
  return Number.isInteger(nombre) && nombre > 0 ? nombre : valeurParDefaut;
}
