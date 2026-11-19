ALTER TABLE signalements
    ADD COLUMN IF NOT EXISTS trajet_id BIGINT REFERENCES trajets(id),
    ADD COLUMN IF NOT EXISTS cle_idempotence UUID,
    ADD COLUMN IF NOT EXISTS observe_le TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS recu_le TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS position geometry(Point, 4326),
    ADD COLUMN IF NOT EXISTS archive_le TIMESTAMPTZ;

UPDATE signalements
SET observe_le = COALESCE(observe_le, cree_le),
    recu_le = COALESCE(recu_le, cree_le),
    cle_idempotence = COALESCE(cle_idempotence, gen_random_uuid())
WHERE observe_le IS NULL
   OR recu_le IS NULL
   OR cle_idempotence IS NULL;

ALTER TABLE signalements
    ALTER COLUMN bus_id DROP NOT NULL,
    ALTER COLUMN observe_le SET NOT NULL,
    ALTER COLUMN recu_le SET NOT NULL,
    ALTER COLUMN cle_idempotence SET NOT NULL,
    ALTER COLUMN recu_le SET DEFAULT now();

ALTER TABLE signalements
    DROP CONSTRAINT IF EXISTS chk_signalements_cible,
    ADD CONSTRAINT chk_signalements_cible
        CHECK (bus_id IS NOT NULL OR trajet_id IS NOT NULL);

ALTER TABLE signalements
    DROP CONSTRAINT IF EXISTS chk_signalements_dates,
    ADD CONSTRAINT chk_signalements_dates
        CHECK (observe_le <= recu_le);

ALTER TABLE signalements
    DROP CONSTRAINT IF EXISTS uq_signalements_idempotence,
    ADD CONSTRAINT uq_signalements_idempotence
        UNIQUE (auteur_id, cle_idempotence);

ALTER TABLE signalements
    DROP CONSTRAINT IF EXISTS chk_signalements_position,
    ADD CONSTRAINT chk_signalements_position
        CHECK (position IS NULL OR (
            ST_X(position) BETWEEN -180 AND 180
            AND ST_Y(position) BETWEEN -90 AND 90
        ));

CREATE INDEX IF NOT EXISTS idx_signalements_auteur
    ON signalements (auteur_id, recu_le DESC);
CREATE INDEX IF NOT EXISTS idx_signalements_bus
    ON signalements (bus_id);
CREATE INDEX IF NOT EXISTS idx_signalements_trajet
    ON signalements (trajet_id);
CREATE INDEX IF NOT EXISTS idx_signalements_position
    ON signalements USING GIST (position);
