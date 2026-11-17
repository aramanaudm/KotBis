export class Trajet {
  static table = 'trajets';
  static primaryKey = 'id';
  static transient = ['archive_le', 'cree_le', 'modifie_le', 'version'];

  constructor(
    public id: number | null,
    public code: string,
    public ligne_id: number,
    public nom: string,
    public direction: string,
    public actif: boolean = false,
    public archive_le: Date | null = null,
    public cree_le: Date | null = null,
    public modifie_le: Date | null = null,
    public version: number = 1
  ) {}
}