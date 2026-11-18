CREATE TABLE favoris (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  voyageur_id      BIGINT NOT NULL REFERENCES voyageurs(compte_id) ON DELETE CASCADE,
  type             VARCHAR(20) NOT NULL CHECK (type IN ('destination','trajet')),
  arret_depart_id  BIGINT REFERENCES arrets(id),
  arret_arrivee_id BIGINT NOT NULL REFERENCES arrets(id),
  libelle          VARCHAR(80),
  cree_le          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_favoris ON favoris
  (voyageur_id, type, COALESCE(arret_depart_id, 0), arret_arrivee_id);