-- KBE-32 : sessions de partage de position

CREATE TABLE IF NOT EXISTS sessions_partage_position (
    id UUID PRIMARY KEY,
    compte_id BIGINT NOT NULL REFERENCES comptes(id),
    date_debut TIMESTAMPTZ NOT NULL DEFAULT now(),
    date_fin TIMESTAMPTZ,
    date_expiration TIMESTAMPTZ NOT NULL,
    statut VARCHAR(10) NOT NULL DEFAULT 'active',

    CONSTRAINT chk_partage_statut
        CHECK (statut IN ('active', 'arretee', 'expiree')),

    CONSTRAINT chk_partage_expiration
        CHECK (date_expiration > date_debut),

    CONSTRAINT chk_partage_date_fin
        CHECK (date_fin IS NULL OR date_fin >= date_debut),

    CONSTRAINT chk_partage_coherence
        CHECK (
            (statut = 'active' AND date_fin IS NULL)
            OR
            (statut IN ('arretee', 'expiree') AND date_fin IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_partage_compte
    ON sessions_partage_position (compte_id);

CREATE INDEX IF NOT EXISTS idx_partage_statut
    ON sessions_partage_position (statut);