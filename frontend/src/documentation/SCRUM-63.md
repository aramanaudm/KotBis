# SCRUM-63 [BUS-FE-048] Limitation visuelle d'un avis à 600 caractères

Dépendance : commit SCRUM-62. Comparer à la branche SCRUM-62 pour isoler ce ticket.

Le formulaire explique la limite, expose un compteur réactif et annonce la limite atteinte.
Le maxlength natif bloque la saisie au-delà de 600. Le validateur Angular et le service
refusent aussi une valeur de 601 injectée directement, pour publication et modification.
Le comptage est cohérent avec maxlength et String.length. Il inclut les espaces avant
normalisation du texte. Le formulaire conserve le texte invalide pour permettre sa correction.
