export class Ligne {
  static table = 'lignes';
  static primaryKey = 'id';
  // Colonnes gérées par le serveur (DEFAULT now(), trigger...)
  static transient = ['archiveLe', 'creeLe', 'modifieLe', 'version'];

  constructor(
    public id: number | null,
    public code: string,
    public libelle: string,
    public actif: boolean = true,
    public archiveLe: Date | null = null,
    public creeLe: Date | null = null,
    public modifieLe: Date | null = null,
    public version: number = 1
  ) {}
}