export class Compte {
  static table = 'comptes';
  static primaryKey = 'id';
  static transient = ['cree_le', 'modifie_le', 'version', 'invitation_hash', 'invitation_expire_le'];

  constructor(
    public id: number | null,
    public email: string,
    public mot_de_passe_hash: string | null,
    public role_id: number,
    public etat: 'invite' | 'actif' | 'inactif',
    public identifiant_public: string,
    public cree_le: Date | null = null,
    public modifie_le: Date | null = null,
    public version: number = 1
  ) {}
}