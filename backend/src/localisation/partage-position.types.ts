// Ce fichier définit les types de données utilisés pour gérer le partage
// de position GPS des voyageurs dans l'application KotBis.
// Il permet aux autres fichiers du module de travailler avec les mêmes
// informations et de vérifier leur structure grâce à TypeScript.

// Définit les trois états possibles d'une session de partage GPS.
// "active" : le voyageur a démarré le partage de sa position.
// "arretee" : le voyageur a volontairement arrêté le partage.
// "expiree" : la durée autorisée du partage est dépassée.
export type StatutPartage = "active" | "arretee" | "expiree";

// Représente une session de partage de position GPS.
// Chaque session est associée à un compte utilisateur afin de savoir
// quel voyageur a autorisé le partage et de sécuriser son arrêt.
export interface SessionPartagePosition {

  // Identifiant unique permettant de retrouver une session.
  id: string;

  // Identifiant du compte auquel appartient cette session.
  // Il permettra de vérifier qu'un voyageur ne peut gérer
  // que ses propres sessions de partage.
  compteId: number;

  // Date et heure auxquelles le voyageur a démarré le partage.
  dateDebut: Date;

  // Date et heure auxquelles le partage a été arrêté.
  // La valeur est null tant qu'aucun arrêt n'a été enregistré.
  dateFin: Date | null;

  // Date et heure après lesquelles le partage ne sera plus autorisé.
  // La durée exacte sera définie avec l'équipe.
  dateExpiration: Date;

  // État actuel du partage : active, arretee ou expiree.
  statut: StatutPartage;
}


// Ce contrat définit les opérations nécessaires pour stocker et retrouver
// les sessions de partage GPS. Il permet au service de fonctionner sans
// dépendre directement de la structure actuelle de PostgreSQL.
export interface StockageSessionPartage {

  // Enregistre une nouvelle session lorsque le voyageur démarre le partage.
  creer(session: SessionPartagePosition): Promise<void>;

  // Recherche une session à partir de son identifiant.
  // Retourne null lorsque la session n'existe pas.
  trouverParId(id: string): Promise<SessionPartagePosition | null>;

  // Enregistre les modifications d'une session, notamment son arrêt
  // ou son expiration. Le stockage devra aussi vérifier que la
  // modification est autorisée et reste cohérente en cas d'accès simultanés.
  modifier(session: SessionPartagePosition): Promise<void>;
}