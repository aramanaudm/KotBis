# README — Préparation de la base pour la page d’accueil

## Ticket

`backoffice/KB-41_Préparer_bdd_page_accueil`

## Objectif

Identifier les données nécessaires à la page d’accueil voyageur, vérifier que
les tables existantes couvrent les besoins, préparer les données de test et
fournir au Backend les champs et exemples attendus.

## Branche

```text
backoffice/KB-41_Préparer_bdd_page_accueil
```

Branche créée depuis `develop`.

## Fichiers ajoutés ou modifiés

```text
database/migrations/002_page_accueil.sql
database/seeds/page_accueil.sql
database/tests/page_accueil.sql
database/README.md
docs/README.md
```

Aucun fichier `backend/` ou `frontend/` n’a été modifié.

## Environnement vérifié

- PostgreSQL 18
- PostGIS 3.7
- Base : `kotbis`
- Tests SQL exécutés avec succès

> PostGIS a été installé sur PostgreSQL 18. Smart App Control de Windows a dû
> être désactivé pour autoriser le chargement des DLL PostGIS non signées.

## Décision sur les destinations populaires

Pour la version 1, les destinations populaires sont **globales** : elles sont
identiques pour tous les visiteurs. Elles ne sont pas stockées par utilisateur.

La maquette Figma affiche une liste de destinations populaires, pas une liste
de favoris personnels.

Si le produit décide plus tard de personnaliser ces raccourcis, il faudra :

1. authentifier le voyageur ;
2. créer une table de liaison par utilisateur ;
3. ajouter un endpoint authentifié.

Proposition de table future, **non créée dans la v1** :

```sql
CREATE TABLE destinations_utilisateur (
    compte_id BIGINT NOT NULL REFERENCES comptes(id),
    arret_id BIGINT NOT NULL REFERENCES arrets(id),
    ordre INTEGER NOT NULL DEFAULT 1,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (compte_id, arret_id)
);
```

## Données nécessaires à l’accueil

| Élément de l’accueil | Donnée | Champ API | Table / vue |
|---|---|---|---|
| Message d’accueil | Aucune donnée personnelle | — | — |
| Départ | Position actuelle | latitude, longitude | — |
| Départ | Arrêts proches | code, nom, latitude, longitude, distanceMetres | arrets + PostGIS |
| Destination | Recherche d’arrêts | code, nom, latitude, longitude | v_arrets_publics |
| Destinations populaires | Code, libellé, localité | code, libelle, localite, latitude, longitude | v_destinations_populaires |
| Carte | Marqueurs d’arrêts | code, nom, latitude, longitude | v_arrets_publics |
| Navigation | Aucune donnée | — | — |
| « Trouver mon bus » | Recherche d’itinéraire | hors périmètre de ce ticket | vues trajets préparées |

## Vérification des tables existantes

| Besoin | Table existante | Couverture |
|---|---|---|
| Arrêts et coordonnées | arrets | Oui |
| Lignes | lignes | Oui |
| Trajets | trajets | Oui |
| Ordre des arrêts | trajet_arrets | Oui |
| Zones | zones | Oui, non utilisée pour la carte v1 |
| Comptes / voyageurs | comptes, voyageurs | Oui, non utilisés pour la v1 |
| Destinations populaires | arrets + vue v_destinations_populaires | Oui, sans nouvelle table |

Conclusion : les tables existantes couvrent les besoins de la page d’accueil.
Aucune nouvelle table n’est nécessaire pour la v1.

## Objets SQL ajoutés

### Vues

- `v_arrets_publics` : arrêts actifs et non archivés avec latitude/longitude.
- `v_lignes_publiques` : lignes actives.
- `v_trajets_publics` : trajets actifs avec code/ligne.
- `v_trajet_arrets_publics` : arrêts ordonnés des trajets.
- `v_destinations_populaires` : les trois raccourcis de l’accueil.

### Index

- `idx_arrets_nom_lower` sur `lower(nom)`.

### Aucune table créée

Les destinations populaires sont des arrêts existants (`A001`, `A002`,
`A003`). Leur ordre et leur localité sont définis dans la vue.

## Jeu de données de test

Le seed `database/seeds/page_accueil.sql` ajoute :

- 5 arrêts : Gare Victoria, Grand Baie, Moka, Rose-Hill, Curepipe ;
- 2 lignes : L001, L002 ;
- 2 trajets : T001, T002 ;
- 5 étapes ordonnées de trajet.

Coordonnées utilisées :

| Code | Nom | Latitude | Longitude |
|---|---|---|---|
| A001 | Gare Victoria | -20.1619 | 57.4989 |
| A002 | Grand Baie | -20.0133 | 57.5806 |
| A003 | Moka | -20.2181 | 57.4963 |
| A004 | Rose-Hill | -20.2420 | 57.4717 |
| A005 | Curepipe | -20.3167 | 57.5167 |

Les coordonnées sont fictives et servent uniquement aux tests locaux.

## Tests SQL

Le fichier `database/tests/page_accueil.sql` vérifie :

- 3 destinations populaires ;
- 5 arrêts publics ;
- 2 trajets publics ;
- 5 étapes de trajet ;
- aucun arrêt inactif ou archivé dans `v_arrets_publics`.

Résultat obtenu :

```text
destinations | 3
arrets       | 5
trajets      | 2
etapes       | 5
```

## Contrat API pour le Backend

Base URL :

```text
/api
```

Routes publiques, en lecture seule, sans authentification pour la v1.

### GET /api/accueil

```http
GET /api/accueil?latitude=-20.2420&longitude=57.4717&rayon=5000
```

Paramètres :

| Paramètre | Type | Obligatoire | Description |
|---|---|---|---|
| latitude | number | Non | Latitude de l’utilisateur |
| longitude | number | Non | Longitude de l’utilisateur |
| rayon | integer | Non | Rayon en mètres, 5000 par défaut |

Réponse :

```json
{
  "destinationsPopulaires": [
    {
      "ordre": 1,
      "code": "A001",
      "libelle": "Gare Victoria",
      "localite": "Port-Louis",
      "latitude": -20.1619,
      "longitude": 57.4989
    },
    {
      "ordre": 2,
      "code": "A002",
      "libelle": "Grand Baie",
      "localite": "Rivière du Rempart",
      "latitude": -20.0133,
      "longitude": 57.5806
    },
    {
      "ordre": 3,
      "code": "A003",
      "libelle": "Moka",
      "localite": "Moka",
      "latitude": -20.2181,
      "longitude": 57.4963
    }
  ],
  "arretsProches": [
    {
      "code": "A001",
      "nom": "Gare Victoria",
      "latitude": -20.1619,
      "longitude": 57.4989,
      "distanceMetres": 420
    }
  ]
}
```

### GET /api/arrets

```http
GET /api/arrets?search=victoria&limit=20
```

Sans `search`, retourne tous les arrêts publics. Cette route alimente aussi les
marqueurs de la carte.

Réponse :

```json
[
  {
    "code": "A001",
    "nom": "Gare Victoria",
    "latitude": -20.1619,
    "longitude": 57.4989
  }
]
```

### GET /api/arrets/proches

```http
GET /api/arrets/proches?latitude=-20.2420&longitude=57.4717&rayon=5000&limit=10
```

Réponse :

```json
[
  {
    "code": "A004",
    "nom": "Rose-Hill",
    "latitude": -20.242,
    "longitude": 57.4717,
    "distanceMetres": 0
  }
]
```

### Erreurs

| Code | Cas |
|---|---|
| 400 | Latitude/longitude invalides ou rayon négatif |
| 500 | Erreur serveur ou base indisponible |

```json
{
  "error": "bad_request",
  "message": "Coordonnées invalides."
}
```

## Vues SQL à utiliser par le Backend

| Endpoint | Vue / table |
|---|---|
| `GET /api/accueil` — destinations | `v_destinations_populaires` |
| `GET /api/accueil` — arrêts proches | `arrets` + PostGIS |
| `GET /api/arrets` | `v_arrets_publics` |
| `GET /api/arrets/proches` | `arrets` + PostGIS |
| Carte | `v_arrets_publics` |

## Requête PostGIS — arrêts proches

```sql
SELECT
    code,
    nom,
    ST_Y(position) AS latitude,
    ST_X(position) AS longitude,
    ROUND(
        ST_Distance(
            position::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )::numeric,
        0
    ) AS distance_metres
FROM arrets
WHERE actif = TRUE
  AND archive_le IS NULL
  AND ST_DWithin(
      position::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
  )
ORDER BY distance_metres
LIMIT 10;
```

`$1` = longitude, `$2` = latitude, `$3` = rayon en mètres.

## Application des scripts

Depuis la racine du dépôt :

```bash
psql -U postgres -d kotbis -f database/kotbis_schema.sql
psql -U postgres -d kotbis -f database/migrations/002_page_accueil.sql
psql -U postgres -d kotbis -f database/seeds/page_accueil.sql
psql -U postgres -d kotbis -f database/tests/page_accueil.sql
```

> `kotbis_schema.sql` ne doit être exécuté qu’une seule fois sur une base
> vierge. Sur une base existante, exécuter uniquement la migration, le seed et
> les tests.

## Critères d’acceptation

| Critère | État |
|---|---|
| Liste des données nécessaires à l’accueil | ✅ Documentée |
| Validation avec le Frontend | ⚠️ Checklist à faire valider |
| Tables et champs documentés | ✅ |
| Jeu de données de test | ✅ Testé |
| Exemple de données pour le Backend | ✅ Contrat API + JSON |

## Points restants

- Faire valider la liste des données et les noms de champs avec le Frontend.
- Confirmer que les destinations populaires restent globales.
- Faire relire le contrat API par le Backend.
- Implémenter les endpoints côté Backend.
- Si la personnalisation est demandée : créer la table
  `destinations_utilisateur` et l’endpoint authentifié.

## Hors périmètre

- recherche d’itinéraire avec ou sans correspondance ;
- authentification et profil voyageur ;
- favoris ;
- avis et signalements ;
- temps réel des bus ;
- horaires théoriques ou temps de passage.

Les vues `v_lignes_publiques`, `v_trajets_publics` et
`v_trajet_arrets_publics` sont disponibles pour la personne chargée de la
recherche d’itinéraire.
