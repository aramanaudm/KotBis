BEGIN;

CREATE TABLE IF NOT EXISTS quotas_visiteurs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    nombre_recherches INTEGER NOT NULL DEFAULT 0,

    cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),

    derniere_recherche_le TIMESTAMPTZ,

    CONSTRAINT chk_quotas_visiteurs_nombre
        CHECK (nombre_recherches BETWEEN 0 AND 10),

    CONSTRAINT chk_quotas_visiteurs_derniere
        CHECK (
            derniere_recherche_le IS NULL
            OR derniere_recherche_le >= cree_le
        )
);

COMMIT;