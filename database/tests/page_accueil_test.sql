-- Vérifications de la page d'accueil.
-- Ticket : backoffice/KB-41_Préparer_bdd_page_accueil
-- À exécuter après le schéma, la migration 002 et le seed.
-- Le script échoue si les objets attendus sont incohérents.

DO $$
BEGIN
    IF (SELECT count(*) FROM v_destinations_populaires) <> 3 THEN
        RAISE EXCEPTION 'La vue v_destinations_populaires doit contenir 3 lignes.';
    END IF;

    IF (SELECT count(*) FROM v_arrets_publics) <> 1429 THEN
        RAISE EXCEPTION 'La vue v_arrets_publics doit contenir 1429 arrêts actifs.';
    END IF;

    IF (SELECT count(*) FROM v_trajets_publics) <> 528 THEN
        RAISE EXCEPTION 'La vue v_trajets_publics doit contenir 528 trajets.';
    END IF;

    IF (SELECT count(*) FROM v_trajet_arrets_publics) <> 14342 THEN
        RAISE EXCEPTION 'La vue v_trajet_arrets_publics doit contenir 14342 étapes.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM v_arrets_publics ap
        JOIN arrets a ON a.code = ap.code
        WHERE a.actif = FALSE OR a.archive_le IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'v_arrets_publics contient un arrêt inactif ou archivé.';
    END IF;
END $$;

SELECT 'destinations' AS vue, count(*) AS lignes FROM v_destinations_populaires
UNION ALL
SELECT 'arrets', count(*) FROM v_arrets_publics
UNION ALL
SELECT 'trajets', count(*) FROM v_trajets_publics
UNION ALL
SELECT 'etapes', count(*) FROM v_trajet_arrets_publics;
