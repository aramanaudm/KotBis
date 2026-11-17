export class Role {
  static table = 'roles';
  static primaryKey = 'id';

  constructor(
    public id: number | null,
    public code: string,
    public libelle: string
  ) {}
}