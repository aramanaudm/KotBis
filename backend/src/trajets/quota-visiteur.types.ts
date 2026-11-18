// KBE-45 : quota de recherches des visiteurs (EF-VIS-001 à EF-VIS-008, DEC-017).
// Types et contrat de stockage du quota. La table PostgreSQL `quotas_visiteurs`
// est créée par l'équipe BO/BDD ; ce module ne contient aucune migration.

// Règles validées par l'équipe :
// - 10 recherches réussies au total pour un visiteur, jamais remises à zéro ;
// - seule une recherche réussie est comptée (y compris « aucun résultat ») ;
// - le visiteur est identifié par un jeton aléatoire émis par le serveur ;
// - l'adresse IP ne sert qu'à plafonner les nouveaux jetons par IP sur 24 h,
//   sous forme d'empreinte HMAC ;
// - un compte connecté n'est jamais soumis au quota.

// Stockage du quota : une ligne par jeton visiteur.
export interface DepotQuotaVisiteurs {
  // Crée un jeton visiteur (compteur à 0) et retourne son identifiant (UUID).
  creerJeton(empreinteIp: string, maintenant: Date): Promise<string>;

  // Nombre de jetons émis pour cette empreinte d'IP depuis la date donnée.
  compterJetonsDepuis(empreinteIp: string, depuis: Date): Promise<number>;

  // Indique si le jeton existe.
  existe(jeton: string): Promise<boolean>;

  // Réserve une recherche de façon atomique : +1 seulement si le compteur est
  // inférieur à `maximum`. Retourne le nouveau compteur, ou null si le jeton est
  // inconnu ou si la limite est déjà atteinte.
  reserver(jeton: string, maximum: number, maintenant: Date): Promise<number | null>;

  // Rend une recherche réservée (-1, jamais en dessous de 0).
  rendre(jeton: string): Promise<void>;

  // Efface les empreintes d'IP des jetons émis avant la date donnée.
  effacerEmpreintesAvant(date: Date): Promise<void>;
}

// Résultat d'une réservation réussie.
export interface ReservationQuota {
  // Jeton à renvoyer à l'application (nouveau ou existant).
  jeton: string;
  // Vrai si le jeton vient d'être émis par le serveur.
  nouveauJeton: boolean;
  // Recherches encore disponibles si celle-ci réussit.
  restant: number;
}

export interface OptionsQuotaVisiteur {
  // Nombre maximal de recherches réussies par visiteur (défaut : 10).
  quotaMax?: number;
  // Nombre maximal de nouveaux jetons par IP sur 24 h (défaut : 20).
  plafondJetonsParIp?: number;
  // Secret utilisé pour l'empreinte HMAC des adresses IP (obligatoire).
  secretEmpreinteIp: string;
  // Horloge injectable pour les tests.
  maintenant?: () => Date;
}
