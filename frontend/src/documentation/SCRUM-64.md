# SCRUM-64 [BUS-FE-049] Création du formulaire de signalement d'un bus

Cette version reprend la base fonctionnelle SCRUM-63. Le nouveau commit ne porte que sur le signalement.

- Route /home/signaler et alias /signaler, accessible depuis la carte.
- Fenêtre avec retour, fermeture, sélection d'un bus et envoi réservé à la session.
- Validation du bus, prévention du double envoi, erreur sans perte de sélection.
- Reçu de démonstration avec statut initial À vérifier et retour à la carte.
- Service en mémoire, même raccordement COMMUNITY_SESSION que les avis.
- Aucun champ catégorie (SCRUM-65), commentaire (SCRUM-66), liste de suivi (SCRUM-67) ou administration (SCRUM-68).

Le reçu reste sur le formulaire car la page de suivi n'appartient pas à ce ticket.
Aucun signalement réel n'est envoyé, l'API et la connexion restent à raccorder.
