interface Tentative {
  nombre: number;
  expiration: number;
}

export class LimiteurTentatives {
  private readonly tentatives = new Map<string, Tentative>();

  constructor(
    private readonly maximum: number,
    private readonly fenetreMs: number
  ) {}

  estBloque(cle: string, maintenant: number = Date.now()): boolean {
    const tentative = this.tentatives.get(cle);
    if (!tentative) {
      return false;
    }
    if (tentative.expiration <= maintenant) {
      this.tentatives.delete(cle);
      return false;
    }
    return tentative.nombre >= this.maximum;
  }

  enregistrerEchec(cle: string, maintenant: number = Date.now()): void {
    const tentative = this.tentatives.get(cle);
    if (!tentative || tentative.expiration <= maintenant) {
      this.tentatives.set(cle, { nombre: 1, expiration: maintenant + this.fenetreMs });
      return;
    }
    tentative.nombre += 1;
  }

  reinitialiser(cle: string): void {
    this.tentatives.delete(cle);
  }
}
