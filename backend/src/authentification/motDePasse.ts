import argon2 from "argon2";

const OPTIONS_HACHAGE = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  return argon2.hash(motDePasse, OPTIONS_HACHAGE);
}

export async function verifierMotDePasse(hash: string | null, motDePasse: string): Promise<boolean> {
  if (!hash) {
    return false;
  }
  try {
    return await argon2.verify(hash, motDePasse);
  } catch {
    return false;
  }
}
