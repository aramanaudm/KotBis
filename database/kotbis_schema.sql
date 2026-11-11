-- 1. Creation de la base
CREATE DATABASE kotbis;
\c kotbis

-- 2. Extension PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 3. Tables, index, vues
CREATE TABLE roles (
    id                    SMALLINT PRIMARY KEY,
    code                  VARCHAR(30) NOT NULL UNIQUE,
    libelle               VARCHAR(80) NOT NULL,
    CONSTRAINT chk_roles_code CHECK (code IN ('voyageur','operateur','moderateur','administrateur'))
);

CREATE TABLE comptes (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email                 VARCHAR(254) NOT NULL,
    mot_de_passe_hash     TEXT,
    role_id               SMALLINT NOT NULL REFERENCES roles(id),
    etat                  VARCHAR(20) NOT NULL CHECK (etat IN ('invite','actif','inactif')),
    identifiant_public    VARCHAR(40) NOT NULL UNIQUE,
    invitation_hash       TEXT UNIQUE,
    invitation_expire_le  TIMESTAMPTZ,
    version               INTEGER NOT NULL DEFAULT 1,
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    modifie_le            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_comptes_actif_hash CHECK (etat <> 'actif' OR mot_de_passe_hash IS NOT NULL),
    CONSTRAINT chk_comptes_invitation CHECK (invitation_hash IS NULL OR invitation_expire_le IS NOT NULL)
);
CREATE UNIQUE INDEX uq_comptes_email ON comptes (lower(email));

CREATE TABLE personnel (
    compte_id             BIGINT PRIMARY KEY REFERENCES comptes(id),
    nom_affiche           VARCHAR(120) NOT NULL CHECK (char_length(btrim(nom_affiche)) > 0),
    fonction              VARCHAR(100),
    version               INTEGER NOT NULL DEFAULT 1,
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    modifie_le            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE voyageurs (
    compte_id             BIGINT PRIMARY KEY REFERENCES comptes(id),
    pseudo                VARCHAR(60) NOT NULL CHECK (char_length(btrim(pseudo)) > 0),
    avatar_ref            VARCHAR(120),
    zone_libre            VARCHAR(120),
    version               INTEGER NOT NULL DEFAULT 1,
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    modifie_le            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_voyageurs_pseudo ON voyageurs (lower(pseudo));

CREATE TABLE sessions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compte_id             BIGINT NOT NULL REFERENCES comptes(id),
    empreinte_jeton       TEXT NOT NULL UNIQUE,
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    expire_le             TIMESTAMPTZ NOT NULL,
    revoque_le            TIMESTAMPTZ,
    CONSTRAINT chk_sessions_expire CHECK (expire_le > cree_le)
);

CREATE TABLE lignes (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                  VARCHAR(20) NOT NULL UNIQUE,
    libelle               VARCHAR(150) NOT NULL CHECK (char_length(btrim(libelle)) > 0),
    actif                 BOOLEAN NOT NULL DEFAULT TRUE,
    archive_le            TIMESTAMPTZ,
    version               INTEGER NOT NULL DEFAULT 1,
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    modifie_le            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bus (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plaque                VARCHAR(25) NOT NULL,
    etat                  VARCHAR(20) NOT NULL CHECK (etat IN ('actif','inactif','en_panne')),
    actif                 BOOLEAN NOT NULL DEFAULT TRUE,
    archive_le            TIMESTAMPTZ,
    version               INTEGER NOT NULL DEFAULT 1,
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    modifie_le            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_bus_plaque
    ON bus (upper(regexp_replace(plaque, '\s', '', 'g')));

CREATE TABLE arrets (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                  VARCHAR(30) NOT NULL UNIQUE,
    nom                   VARCHAR(150) NOT NULL CHECK (char_length(btrim(nom)) > 0),
    position              geometry(Point, 4326) NOT NULL,
    actif                 BOOLEAN NOT NULL DEFAULT TRUE,
    archive_le            TIMESTAMPTZ,
    version               INTEGER NOT NULL DEFAULT 1,
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    modifie_le            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_arrets_bornes CHECK (ST_X(position) BETWEEN -180 AND 180
                                    AND ST_Y(position) BETWEEN -90 AND 90)
);
CREATE INDEX idx_arrets_position ON arrets USING GIST (position);

CREATE TABLE trajets (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                  VARCHAR(30) NOT NULL UNIQUE,
    ligne_id              BIGINT NOT NULL REFERENCES lignes(id),
    nom                   VARCHAR(180) NOT NULL,
    direction             VARCHAR(180) NOT NULL,
    actif                 BOOLEAN NOT NULL DEFAULT FALSE,
    archive_le            TIMESTAMPTZ,
    version               INTEGER NOT NULL DEFAULT 1,
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    modifie_le            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trajet_arrets (
    trajet_id             BIGINT NOT NULL REFERENCES trajets(id),
    ordre                 INTEGER NOT NULL,
    arret_id              BIGINT NOT NULL REFERENCES arrets(id),
    minutes_depuis_depart INTEGER,
    PRIMARY KEY (trajet_id, ordre),
    CONSTRAINT chk_ordre_positif CHECK (ordre > 0),
    CONSTRAINT chk_minutes_positives CHECK (minutes_depuis_depart IS NULL
                                    OR minutes_depuis_depart >= 0)
);

CREATE TABLE zones (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                  VARCHAR(30) NOT NULL UNIQUE,
    nom                   VARCHAR(150) NOT NULL CHECK (char_length(btrim(nom)) > 0),
    contour               geometry(Polygon, 4326) NOT NULL,
    actif                 BOOLEAN NOT NULL DEFAULT FALSE,
    archive_le            TIMESTAMPTZ,
    version               INTEGER NOT NULL DEFAULT 1,
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    modifie_le            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_zones_contour CHECK (ST_IsValid(contour)
                                    AND NOT ST_IsEmpty(contour) AND ST_Area(contour) > 0)
);
CREATE INDEX idx_zones_contour ON zones USING GIST (contour);

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE affectations_bus (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bus_id                BIGINT NOT NULL REFERENCES bus(id),
    trajet_id             BIGINT NOT NULL REFERENCES trajets(id),
    debut_le              TIMESTAMPTZ NOT NULL,
    fin_le                TIMESTAMPTZ,
    cree_par              BIGINT NOT NULL REFERENCES personnel(compte_id),
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_periode CHECK (fin_le IS NULL OR fin_le > debut_le),
    CONSTRAINT excl_affectation_chevauchement
        EXCLUDE USING gist (bus_id WITH =, tstzrange(debut_le, fin_le, '[)') WITH &&)
);

CREATE TABLE signalements (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference             VARCHAR(30) NOT NULL UNIQUE,
    auteur_id             BIGINT NOT NULL REFERENCES voyageurs(compte_id),
    bus_id                BIGINT NOT NULL REFERENCES bus(id),
    type                  VARCHAR(30) NOT NULL,
    commentaire           VARCHAR(600),
    statut                VARCHAR(25) NOT NULL,
    version               INTEGER NOT NULL DEFAULT 1,
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_signalements_type CHECK (type IN ('en_panne','autre')),
    CONSTRAINT chk_signalements_statut CHECK (statut IN ('a_verifier','confirme','classe_sans_suite'))
);
CREATE INDEX idx_signalements_statut ON signalements (statut, cree_le);

CREATE TABLE historique_signalements (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    signalement_id        BIGINT NOT NULL REFERENCES signalements(id),
    agent_id              BIGINT NOT NULL REFERENCES personnel(compte_id),
    ancien_statut         VARCHAR(25) NOT NULL,
    nouveau_statut        VARCHAR(25) NOT NULL,
    motif                 TEXT NOT NULL CHECK (char_length(btrim(motif)) > 0),
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_hs_ancien CHECK (ancien_statut IN ('a_verifier','confirme','classe_sans_suite')),
    CONSTRAINT chk_hs_nouveau CHECK (nouveau_statut IN ('a_verifier','confirme','classe_sans_suite'))
);
CREATE INDEX idx_hist_signalements_signalement ON historique_signalements (signalement_id);

CREATE TABLE avis (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference             VARCHAR(30) NOT NULL UNIQUE,
    auteur_id             BIGINT NOT NULL REFERENCES voyageurs(compte_id),
    trajet_id             BIGINT NOT NULL REFERENCES trajets(id),
    texte                 VARCHAR(600) NOT NULL,
    statut                VARCHAR(20) NOT NULL,
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    modifie_le            TIMESTAMPTZ NOT NULL DEFAULT now(),
    version               INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT chk_avis_texte CHECK (char_length(btrim(texte)) BETWEEN 1 AND 600),
    CONSTRAINT chk_avis_statut CHECK (statut IN ('a_verifier','publie','masque'))
);
CREATE INDEX idx_avis_statut ON avis (statut, cree_le);

CREATE TABLE historique_avis (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    avis_id               BIGINT NOT NULL REFERENCES avis(id),
    agent_id              BIGINT NOT NULL REFERENCES personnel(compte_id),
    ancien_statut         VARCHAR(20) NOT NULL,
    nouveau_statut        VARCHAR(20) NOT NULL,
    motif                 TEXT NOT NULL CHECK (char_length(btrim(motif)) > 0),
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ha_ancien CHECK (ancien_statut IN ('a_verifier','publie','masque')),
    CONSTRAINT chk_ha_nouveau CHECK (nouveau_statut IN ('a_verifier','publie','masque'))
);
CREATE INDEX idx_hist_avis_avis ON historique_avis (avis_id);

CREATE TABLE mouvements_points (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    voyageur_id           BIGINT NOT NULL REFERENCES voyageurs(compte_id),
    agent_id              BIGINT NOT NULL REFERENCES personnel(compte_id),
    variation             INTEGER NOT NULL,
    motif                 TEXT NOT NULL CHECK (char_length(btrim(motif)) > 0),
    cle_idempotence       UUID NOT NULL UNIQUE,
    compense_id           BIGINT UNIQUE REFERENCES mouvements_points(id),
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_variation_non_nulle CHECK (variation <> 0)
);
CREATE INDEX idx_mouvements_voyageur ON mouvements_points (voyageur_id, cree_le);

CREATE TABLE journal_audit (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    acteur_id             BIGINT NOT NULL REFERENCES comptes(id),
    action                VARCHAR(60) NOT NULL,
    table_cible           VARCHAR(60) NOT NULL,
    cle_cible             TEXT NOT NULL,
    avant                 JSONB,
    apres                 JSONB,
    requete_id            UUID NOT NULL,
    cree_le               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index sur cles etrangeres (CDC §6.13)
CREATE INDEX idx_comptes_role            ON comptes (role_id);
CREATE INDEX idx_sessions_compte         ON sessions (compte_id);
CREATE INDEX idx_trajets_ligne           ON trajets (ligne_id);
CREATE INDEX idx_trajet_arrets_arret     ON trajet_arrets (arret_id);
CREATE INDEX idx_affectations_bus        ON affectations_bus (bus_id) WHERE fin_le IS NULL;
CREATE INDEX idx_affectations_trajet     ON affectations_bus (trajet_id);
CREATE INDEX idx_signalements_auteur     ON signalements (auteur_id);
CREATE INDEX idx_signalements_bus        ON signalements (bus_id);
CREATE INDEX idx_avis_auteur             ON avis (auteur_id);
CREATE INDEX idx_avis_trajet             ON avis (trajet_id);
CREATE INDEX idx_hist_signalements_agent ON historique_signalements (agent_id);
CREATE INDEX idx_hist_avis_agent         ON historique_avis (agent_id);
CREATE INDEX idx_mouvements_agent        ON mouvements_points (agent_id);
CREATE INDEX idx_journal_acteur          ON journal_audit (acteur_id);

-- Vues attendues (CDC §6.13)
CREATE VIEW v_soldes_voyageurs AS
    SELECT v.compte_id AS voyageur_id,
           COALESCE(SUM(m.variation), 0) AS solde
    FROM voyageurs v
    LEFT JOIN mouvements_points m ON m.voyageur_id = v.compte_id
    GROUP BY v.compte_id;

CREATE VIEW v_coordonnees_arrets AS
    SELECT id, code, nom,
           ST_Y(position) AS latitude,
           ST_X(position) AS longitude
    FROM arrets;

CREATE VIEW v_affectations_courantes AS
    SELECT *
    FROM affectations_bus
    WHERE debut_le <= now() AND (fin_le IS NULL OR fin_le > now());

CREATE VIEW v_indicateurs_tableau_de_bord AS
    SELECT
      (SELECT count(*) FROM bus
        WHERE actif AND etat = 'actif' AND archive_le IS NULL)  AS bus_en_service,
      (SELECT count(*) FROM zones
        WHERE actif AND archive_le IS NULL)                     AS zones_actives,
      (SELECT count(*) FROM comptes c JOIN roles r ON r.id = c.role_id
        WHERE r.code = 'voyageur')                              AS comptes_voyageurs,
      (SELECT count(*) FROM signalements
        WHERE statut = 'a_verifier')                            AS signalements_a_verifier;
