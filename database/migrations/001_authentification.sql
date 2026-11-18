-- =============================================================================
-- KotBis — Migration 001 : authentification des voyageurs (KBE-22 / KBE-23)
-- =============================================================================
-- À appliquer APRÈS database/kotbis_schema.sql, sur la base kotbis :
--   psql -U postgres -d kotbis -f database/migrations/001_authentification.sql
--
-- Objet : l'inscription (backend/src/authentification/depot.ts) enregistre le
-- téléphone facultatif dans voyageurs.telephone, colonne absente du schéma
-- initial. Sans elle, toute inscription échoue (PostgreSQL 42703, HTTP 500).
--
-- Script idempotent : il peut être relancé sans erreur ni perte de données.
-- Les règles reprennent la validation de l'API (backend/src/authentification/validation.ts) :
-- facultatif, 20 caractères au plus, chiffres, espaces, « + », « ( ) », « . » et « - »,
-- au moins 6 chiffres.
-- =============================================================================

BEGIN;

-- 1. Téléphone facultatif du voyageur (NULL = non renseigné)
ALTER TABLE voyageurs
    ADD COLUMN IF NOT EXISTS telephone VARCHAR(20);

-- 2. Format contrôlé aussi en base, indépendamment de l'interface
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_voyageurs_telephone'
          AND conrelid = 'voyageurs'::regclass
    ) THEN
        ALTER TABLE voyageurs
            ADD CONSTRAINT chk_voyageurs_telephone CHECK (
                telephone IS NULL
                OR (telephone ~ '^\+?[0-9 ().-]{6,20}$'
                    AND char_length(regexp_replace(telephone, '[^0-9]', '', 'g')) >= 6)
            );
    END IF;
END
$$;


COMMIT;
