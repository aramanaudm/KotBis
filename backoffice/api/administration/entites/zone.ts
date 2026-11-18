export class Zone {
  static table = 'zones';
  static primaryKey = 'id';

  constructor(
    public id: number | null,
    public code: string,
    public nom: string,
    public contour: string,  // GeoJSON string
    public actif: boolean = false
  ) {}
}