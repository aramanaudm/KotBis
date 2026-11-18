export interface ProfilUtilisateur {
  compteId: string;
  identifiantPublic: string;
  email: string;
  role: string;
  pseudo: string | null;
  avatarRef: string | null;
  zoneLibre: string | null;
  telephone: string | null;
  creeLe: string;
}

export interface CompteAvecSecret extends ProfilUtilisateur {
  motDePasseHash: string | null;
  etat: string;
}

export interface SessionAuthentification {
  empreinteJeton: string;
}

export interface SessionCreee {
  jeton: string;
  expireLe: string;
}

export interface DonneesInscription {
  pseudo: string;
  email: string;
  motDePasse: string;
  accepteConditions: boolean;
  zoneLibre: string | null;
  telephone: string | null;
}

export interface DonneesConnexion {
  identifiant: string;
  motDePasse: string;
}

export interface DonneesReinitialisation {
  email: string;
  code: string;
  nouveauMotDePasse: string;
}

export interface DonneesChangementMotDePasse {
  motDePasseActuel: string;
  nouveauMotDePasse: string;
}

export interface DonneesChangementEmail {
  email: string;
  motDePasse: string;
}

export interface ChampsProfilModifiables {
  pseudo?: string;
  zoneLibre?: string | null;
  avatarRef?: string | null;
  telephone?: string | null;
}

export interface DonneesSuppressionCompte {
  motDePasse: string;
  motif: string | null;
}
