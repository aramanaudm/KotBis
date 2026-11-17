export class Arret {
  static table = 'arrets';
  static primaryKey = 'id';

  constructor(
    public id: number | null,
    public code: string,
    public nom: string,
    public latitude: number,
    public longitude: number,
    public actif: boolean = true
  ) {}
}