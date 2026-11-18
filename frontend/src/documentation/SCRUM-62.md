# SCRUM-62 [BUS-FE-047] Modification et suppression de ses propres avis

Dépendance : commit SCRUM-61. Comparer à la branche SCRUM-61 pour isoler ces changements.

- Actions conditionnées par l'identifiant stable de COMMUNITY_SESSION.
- Édition par /home/avis/modifier/:id, texte prérempli et bus conservé.
- Refus d'une URL d'édition appartenant à un autre compte.
- Confirmation explicite avant suppression ; Annuler ne modifie rien.
- Le service recontrôle le propriétaire à chaque écriture, y compris si la session change.
- Publication et modification partagent le formulaire.
- Tests avec plusieurs comptes simulés, visiteur, identifiant absent et session perdue.

Le module de connexion de l'équipe et les contrôles d'autorisation côté API restent à raccorder.
