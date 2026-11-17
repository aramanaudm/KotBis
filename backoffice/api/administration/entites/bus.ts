export class Bus {
  static table = 'bus';
  static primaryKey = 'id';
  static transient = ['archiveLe', 'creeLe', 'modifieLe', 'version'];

  constructor(
    public id: number | null,
    public plaque: string,
    public etat: 'actif' | 'inactif' | 'en_panne' = 'actif',
    public actif: boolean = true,
    public archiveLe: Date | null = null,
    public creeLe: Date | null = null,
    public modifieLe: Date | null = null,
    public version: number = 1
  ) {}
}