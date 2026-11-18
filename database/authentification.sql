-- KotBis — Authentification : schéma complémentaire + données de test
-- Aligné sur frontend/src/app/core/auth/ (AuthService, auth.models, auth.validators)
--
-- À exécuter APRÈS kotbis_schema.sql, dans la base de test :
--   psql -U postgres -c "CREATE DATABASE kotbis_test"
--   psql -U postgres -d kotbis_test -f kotbis_schema.sql
--   psql -U postgres -d kotbis_test -f authentification.sql
--
-- Comptes de test :
--   Voyageur       : voyageur.test@kotbis.fr (ou le pseudo voyageur_test) / Voyageur123!
--   Administrateur : admin.test@kotbis.fr                                  / Admin123!
--
-- Deux formats de hash sont fournis pour les deux équipes :
--   * mot_de_passe_hash : Argon2id (sel inclus), colonne lue directement par
--     argon2.verify() dans backend/src/index.ts (route /api/connexion).
--   * sel + mot_de_passe_hash_frontend : SHA-256 hexadécimal de "<sel>:<mot de passe>",
--     identique à AuthService.hash() (frontend : salt + passwordHash).

BEGIN;

-- 1. Rôles : le code 'administrateur' pilote la redirection vers le back-office.
INSERT INTO roles (id, code, libelle) VALUES
  (1, 'voyageur',       'Voyageur'),
  (2, 'operateur',      'Opérateur'),
  (3, 'moderateur',     'Modérateur'),
  (4, 'administrateur', 'Administrateur')
ON CONFLICT DO NOTHING;

-- 2. Champs complémentaires nécessaires au formulaire et à AuthService.
ALTER TABLE comptes
    ADD COLUMN IF NOT EXISTS sel TEXT,
    ADD COLUMN IF NOT EXISTS mot_de_passe_hash_frontend TEXT,
    ADD COLUMN IF NOT EXISTS telephone VARCHAR(20);

COMMENT ON COLUMN comptes.sel IS 'Sel hexadécimal (16 octets) utilisé avec mot_de_passe_hash_frontend';
COMMENT ON COLUMN comptes.mot_de_passe_hash_frontend IS 'SHA-256("<sel>:<mot de passe>") conforme à AuthService.hash()';
COMMENT ON COLUMN comptes.telephone IS 'Téléphone facultatif saisi à l''inscription (RegisterPayload.phone)';

-- 3. Codes de réinitialisation du mot de passe (RESETS_KEY côté frontend, TTL 15 min).
CREATE TABLE IF NOT EXISTS codes_reinitialisation (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    compte_id     BIGINT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
    code          VARCHAR(6) NOT NULL CHECK (code ~ '^[0-9]{6}$'),
    cree_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expire_le     TIMESTAMPTZ NOT NULL,
    consomme_le   TIMESTAMPTZ,
    CONSTRAINT chk_codes_reinitialisation_expire CHECK (expire_le > cree_le)
);
CREATE INDEX IF NOT EXISTS idx_codes_reinitialisation_compte
    ON codes_reinitialisation (compte_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_codes_reinitialisation_actifs
    ON codes_reinitialisation (compte_id) WHERE consomme_le IS NULL;

-- 4. Comptes de test (états 'actif' : hash obligatoire, conforme à chk_comptes_actif_hash).
INSERT INTO comptes (email, mot_de_passe_hash, sel, mot_de_passe_hash_frontend, role_id, etat, identifiant_public, telephone)
VALUES
  ('voyageur.test@kotbis.fr',
   '$argon2id$v=19$m=65536,t=3,p=4$gSvw/xyxGyaKBFUCOGhN3w$tf/IjXCrRGvd1TzhEpMrIo/N0Hv2uBIQ64nY3PlIGjc',
   '1a2b3c4d5e6f708192a3b4c5d6e7f809',
   '5b17c53c0783c8c87c74772b732ca1b09a29e6003a6688237829118ad7e78ce8',
   1, 'actif', 'test-voyageur', '+33 1 23 45 67 89'),
  ('admin.test@kotbis.fr',
   '$argon2id$v=19$m=65536,t=3,p=4$xOHN6O6BqA6rsEUgXKpVOA$3/NdRKpedDlZUtHjQW4xm4SEcPsU7G2kijb3oVYhMmM',
   '9f8e7d6c5b4a39281706f5e4d3c2b1a0',
   '104b20cbb2ab1d0a585fc92860f62162f79b3b071238bbd75e50031c6ec23cdd',
   4, 'actif', 'test-administrateur', '+33 1 98 76 54 32')
ON CONFLICT DO NOTHING;

-- 5. Profils : pseudo/ville pour le voyageur, nom affiché pour l'administrateur.
INSERT INTO voyageurs (compte_id, pseudo, zone_libre)
SELECT c.id, 'voyageur_test', 'Paris'
FROM comptes c
WHERE c.identifiant_public = 'test-voyageur'
ON CONFLICT DO NOTHING;

INSERT INTO personnel (compte_id, nom_affiche, fonction)
SELECT c.id, 'Administrateur Test', 'Administrateur'
FROM comptes c
WHERE c.identifiant_public = 'test-administrateur'
ON CONFLICT DO NOTHING;

-- 6. Sessions de test (restauration de session : SESSION_KEY côté frontend).
INSERT INTO sessions (compte_id, empreinte_jeton, expire_le)
SELECT c.id, 'session-test-voyageur', now() + interval '24 hours'
FROM comptes c
WHERE c.identifiant_public = 'test-voyageur'
ON CONFLICT DO NOTHING;

INSERT INTO sessions (compte_id, empreinte_jeton, expire_le)
SELECT c.id, 'session-test-administrateur', now() + interval '24 hours'
FROM comptes c
WHERE c.identifiant_public = 'test-administrateur'
ON CONFLICT DO NOTHING;

-- 7. Code de réinitialisation de test (code affiché en mode développement).
INSERT INTO codes_reinitialisation (compte_id, code, expire_le)
SELECT c.id, '123456', now() + interval '15 minutes'
FROM comptes c
WHERE c.identifiant_public = 'test-voyageur'
ON CONFLICT DO NOTHING;

COMMIT;

-- Contrôle des données d'authentification créées.
SELECT c.email, r.code AS role, c.etat, v.pseudo, p.nom_affiche
FROM comptes c
JOIN roles r ON r.id = c.role_id
LEFT JOIN voyageurs v ON v.compte_id = c.id
LEFT JOIN personnel p ON p.compte_id = c.id
WHERE c.identifiant_public IN ('test-voyageur', 'test-administrateur')
ORDER BY c.id;
