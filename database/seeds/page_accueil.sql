-- Jeu de données de démonstration pour la page d'accueil.
-- Ticket : backoffice/KB-41_Préparer_bdd_page_accueil
-- À exécuter après database/kotbis_schema.sql et
-- database/migrations/002_page_accueil.sql.
-- Les coordonnées sont fictives et servent uniquement aux tests locaux.

INSERT INTO roles (id, code, libelle) VALUES
    (1, 'voyageur', 'Voyageur'),
    (2, 'operateur', 'Opérateur'),
    (3, 'moderateur', 'Modérateur'),
    (4, 'administrateur', 'Administrateur')
ON CONFLICT (id) DO NOTHING;

INSERT INTO lignes (code, libelle) VALUES
    ('L001', 'Port-Louis ↔ Curepipe'),
    ('L002', 'Port-Louis ↔ Grand Baie')
ON CONFLICT (code) DO NOTHING;

INSERT INTO arrets (code, nom, position) VALUES
    ('A001', 'Gare Victoria', ST_SetSRID(ST_MakePoint(57.4989, -20.1619), 4326)),
    ('A002', 'Grand Baie', ST_SetSRID(ST_MakePoint(57.5806, -20.0133), 4326)),
    ('A003', 'Moka', ST_SetSRID(ST_MakePoint(57.4963, -20.2181), 4326)),
    ('A004', 'Rose-Hill', ST_SetSRID(ST_MakePoint(57.4717, -20.2420), 4326)),
    ('A005', 'Curepipe', ST_SetSRID(ST_MakePoint(57.5167, -20.3167), 4326))
ON CONFLICT (code) DO NOTHING;

INSERT INTO trajets (code, ligne_id, nom, direction, actif)
SELECT 'T001', l.id, 'Port-Louis → Curepipe', 'Port-Louis → Curepipe', TRUE
FROM lignes l
WHERE l.code = 'L001'
ON CONFLICT (code) DO NOTHING;

INSERT INTO trajets (code, ligne_id, nom, direction, actif)
SELECT 'T002', l.id, 'Port-Louis → Grand Baie', 'Port-Louis → Grand Baie', TRUE
FROM lignes l
WHERE l.code = 'L002'
ON CONFLICT (code) DO NOTHING;

INSERT INTO trajet_arrets (trajet_id, ordre, arret_id)
SELECT t.id, v.ordre, a.id
FROM (VALUES
    ('A001', 1),
    ('A004', 2),
    ('A005', 3)
) AS v(code, ordre)
JOIN arrets a ON a.code = v.code
JOIN trajets t ON t.code = 'T001'
ON CONFLICT (trajet_id, ordre) DO NOTHING;

INSERT INTO trajet_arrets (trajet_id, ordre, arret_id)
SELECT t.id, v.ordre, a.id
FROM (VALUES
    ('A001', 1),
    ('A002', 2)
) AS v(code, ordre)
JOIN arrets a ON a.code = v.code
JOIN trajets t ON t.code = 'T002'
ON CONFLICT (trajet_id, ordre) DO NOTHING;
