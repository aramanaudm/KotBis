/**
 * Accord français : 0 et 1 sont au singulier (« 0 point », « 1 point »), à partir de 2 au pluriel.
 * `plural` par défaut = singulier + « s ».
 */
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count < 2 ? singular : plural}`;
}
