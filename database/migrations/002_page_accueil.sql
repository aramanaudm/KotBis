-- Migration 002 — Objets de lecture publique pour la page d'accueil
-- Ticket : backoffice/KB-41_Préparer_bdd_page_accueil
-- À exécuter après database/kotbis_schema.sql.
-- Cette migration ne crée aucune table : elle ajoute des vues de lecture
-- destinées à l'application voyageur et au back-end.

-- Arrêts visibles publiquement : actifs et non archivés.
CREATE OR REPLACE VIEW v_arrets_publics AS
SELECT
    code,
    nom,
    ST_Y(position) AS latitude,
    ST_X(position) AS longitude
FROM arrets
WHERE actif = TRUE
  AND archive_le IS NULL;

-- Lignes actives visibles publiquement.
CREATE OR REPLACE VIEW v_lignes_publiques AS
SELECT
    code,
    libelle
FROM lignes
WHERE actif = TRUE
  AND archive_le IS NULL;

-- Trajets actifs visibles publiquement.
CREATE OR REPLACE VIEW v_trajets_publics AS
SELECT
    t.code,
    t.nom,
    t.direction,
    l.code AS ligne_code,
    l.libelle AS ligne_libelle
FROM trajets t
JOIN lignes l ON l.id = t.ligne_id
WHERE t.actif = TRUE
  AND t.archive_le IS NULL
  AND l.actif = TRUE
  AND l.archive_le IS NULL;

-- Arrêts ordonnés des trajets publics.
CREATE OR REPLACE VIEW v_trajet_arrets_publics AS
SELECT
    t.code AS trajet_code,
    t.nom AS trajet_nom,
    l.code AS ligne_code,
    a.code AS arret_code,
    a.nom AS arret_nom,
    ta.ordre,
    ta.minutes_depuis_depart,
    ST_Y(a.position) AS latitude,
    ST_X(a.position) AS longitude
FROM trajet_arrets ta
JOIN trajets t ON t.id = ta.trajet_id
JOIN lignes l ON l.id = t.ligne_id
JOIN arrets a ON a.id = ta.arret_id
WHERE t.actif = TRUE
  AND t.archive_le IS NULL
  AND l.actif = TRUE
  AND l.archive_le IS NULL
  AND a.actif = TRUE
  AND a.archive_le IS NULL
ORDER BY t.code, ta.ordre;

-- Destinations populaires de la page d'accueil.
-- La liste est volontairement portée par une vue : les destinations sont
-- des arrêts existants. Aucune table supplémentaire n'est nécessaire pour
-- cette première version. L'ordre et la localité sont définis ici.
CREATE OR REPLACE VIEW v_destinations_populaires AS
SELECT
    d.ordre,
    a.code,
    a.nom AS libelle,
    d.localite,
    ST_Y(a.position) AS latitude,
    ST_X(a.position) AS longitude
FROM (
    VALUES
        ('A001', 'Port-Louis', 1),
        ('A002', 'Rivière du Rempart', 2),
        ('A003', 'Moka', 3)
) AS d(code, localite, ordre)
JOIN arrets a ON a.code = d.code
WHERE a.actif = TRUE
  AND a.archive_le IS NULL
ORDER BY d.ordre;

-- Index de recherche simple sur le nom des arrêts.
CREATE INDEX IF NOT EXISTS idx_arrets_nom_lower
    ON arrets (lower(nom));
