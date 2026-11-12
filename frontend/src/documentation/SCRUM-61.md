# SCRUM-61 [BUS-FE-046] Création du formulaire de publication d'un avis

Dépendance : commit SCRUM-60. Comparer cette branche à celle de SCRUM-60 pour isoler ce ticket.

Route /home/avis/nouveau, lien depuis la liste, choix du bus et texte obligatoire.
Le service dérive l'auteur de la session et la ligne du catalogue. Publication en mémoire et retour à la liste.
La longueur maximale appartient au ticket SCRUM-63 ; modification et suppression à SCRUM-62.

## Raccordement de la connexion
Décision utilisateur : attendre le module d'authentification de l'équipe, sans recopier la connexion locale.
Le jeton COMMUNITY_SESSION (community-session.ts) attend un Signal<CommunityUser | null>.
Par défaut il vaut null : le formulaire s'affiche, la publication est désactivée.
L'équipe devra fournir ce jeton depuis son service de session (id stable et pseudo).
Ne pas utiliser un paramètre d'URL ou un identifiant saisi comme preuve de connexion.
Les tests injectent une session simulée. La future API devra vérifier l'authentification côté serveur.

Les avis et le catalogue de bus restent des données de démonstration, non persistantes.
