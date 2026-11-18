# SCRUM-67 [BUS-FE-052] Afficher ses signalements et leur statut

Dépendance : commit SCRUM-68 (route /admin dans app.routes.ts). Comparer à cette branche pour isoler ce ticket.

Références : CDC Frontend BF-13 (EF13), AC-36, § 1.2 (statuts), § 1.5 et OF-05 (données
du seul compte), BF-27 (états explicites, une couleur seule ne transmet pas un statut).

- Route /home/mes-signalements, alias /signalements : la ligne « Signalements » de Mon espace
  ouvre désormais cette page via SectionNavigator, sans modifier Mon espace.
- Accès depuis la carte (« Mes signalements ») et depuis le reçu du formulaire (« Voir mes signalements »).
- Chaque signalement affiche le bus, la catégorie, la date d'envoi (heure de Maurice) et son statut.
- Statuts du CDC : À vérifier, Confirmé, Rejeté, Clôturé. Le statut est écrit en toutes lettres
  avec un symbole et une explication ; la couleur ne fait que l'appuyer.
- Un statut inconnu est affiché « À vérifier », jamais « Confirmé ».
- ReportService.myReports : uniquement les signalements du compte connecté, du plus récent au
  plus ancien ; liste vide pour un visiteur et recalculée au changement de session.
- États explicites : visiteur (invitation à se connecter), liste vide, liste.

Aucune action de modification du statut côté voyageur : le traitement appartient au back-office (SCRUM-68).
Les signalements restent en mémoire ; GET /me/reports et la connexion de l'équipe restent à raccorder.