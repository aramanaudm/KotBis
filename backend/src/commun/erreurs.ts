export interface DetailErreur {
  champ: string;
  message: string;
}

export class ErreurApi extends Error {
  readonly statut: number;
  readonly code: string;
  readonly details?: DetailErreur[];

  constructor(statut: number, code: string, message: string, details?: DetailErreur[]) {
    super(message);
    this.name = "ErreurApi";
    this.statut = statut;
    this.code = code;
    this.details = details;
  }
}

export class ErreurValidation extends ErreurApi {
  constructor(message: string, details?: DetailErreur[]) {
    super(422, "DONNEES_INVALIDES", message, details);
    this.name = "ErreurValidation";
  }
}

export class ErreurAuthentification extends ErreurApi {
  constructor(code = "AUTHENTIFICATION_REQUISE", message = "Une session valide est requise.") {
    super(401, code, message);
    this.name = "ErreurAuthentification";
  }
}

export class ErreurTropDeRequetes extends ErreurApi {
  constructor(message = "Trop de tentatives. Veuillez réessayer plus tard.") {
    super(429, "TROP_DE_TENTATIVES", message);
    this.name = "ErreurTropDeRequetes";
  }
}
