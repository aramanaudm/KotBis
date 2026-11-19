# KotBis — Schéma de base de données

## Description

Ce dossier contient le script SQL permettant de **créer la base de données KotBis** (si elle n’existe pas encore) ainsi que toutes ses tables, contraintes, index et vues.

Le fichier `kotbis\_schema.sql` est aligné avec :

- le **Cahier des charges Back-Office \& Base de données MoBis** (section 6)
- le **Modèle Physique de Données (MPD) version 0.3**

## Prérequis

- **PostgreSQL 16** (ou version compatible)
- Un compte PostgreSQL habilité à :
  - créer une base de données
  - activer des extensions (`postgis`, `btree\_gist`, `pgcrypto`)

- Extension **PostGIS 3.4** installée sur le serveur

## Installation

Exécuter le script avec `psql` :

```bash
psql -U postgres -f kotbis\_schema.sql
```

### Comportement du script

1. **Crée la base `kotbis` uniquement si elle n’existe pas déjà**
2. Se connecte à la base (`\\c kotbis`)
3. Active les extensions (PostGIS, btree_gist, pgcrypto)
4. Crée toutes les tables, index et vues

> Si la base existe déjà, le script continue sans erreur et crée les objets dedans.

### Insertion des rôles de base (à faire après le script)

```sql
\\c kotbis

INSERT INTO roles (id, code, libelle) VALUES
  (1, 'voyageur',       'Voyageur'),
  (2, 'operateur',      'Opérateur'),
  (3, 'moderateur',     'Modérateur'),
  (4, 'administrateur', 'Administrateur')
ON CONFLICT (id) DO NOTHING;
```

## Ce que le script crée

### Base de données

- `kotbis` (créée seulement si absente)

### Extensions

- `postgis` — données géographiques
- `btree\_gist` — contrainte d’exclusion sur les affectations
- `pgcrypto` — génération d’UUID

### Tables (18)

**Identité \& sécurité**

- `roles` — rôles (voyageur, operateur, moderateur, administrateur)
- `comptes` — connexion (email, hash, état, invitation)
- `personnel` — profils agents back-office
- `voyageurs` — profils voyageurs
- `sessions` — sessions / jetons

**Réseau**

- `lignes` — lignes de bus
- `bus` — véhicules (plaque normalisée)
- `arrets` — arrêts géolocalisés (`geometry(Point, 4326)`)
- `trajets` — trajets (sens)
- `trajet\_arrets` — étapes ordonnées
- `zones` — zones de couverture (`geometry(Polygon, 4326)`)
- `affectations\_bus` — historique bus ↔ trajet (sans chevauchement)

**Contributions**

- `signalements` + `historique\_signalements`
- `avis` + `historique\_avis`

**Points \& Audit**

- `mouvements\_points` — journal append-only (idempotence UUID)
- `journal\_audit` — traces des opérations sensibles

### Index spatiaux (GIST)

- `idx\_arrets\_position`
- `idx\_zones\_contour`

### Vues

- `v\_soldes\_voyageurs`
- `v\_coordonnees\_arrets`
- `v\_affectations\_courantes`
- `v\_indicateurs\_tableau\_de\_bord`

## Points techniques importants

| Sujet               | Choix                                              |
| ------------------- | -------------------------------------------------- |
| Création de la base | Conditionnelle (ne plante pas si elle existe déjà) |
| Coordonnées         | EPSG:4326 (X = longitude, Y = latitude)            |
| Soft-delete         | `archive\_le TIMESTAMPTZ` (NULL = non archivé)     |
| Concurrence         | Colonne `version`                                  |
| Affectations        | Exclusion GIST (pas de chevauchement)              |
| Points              | Append-only + clé d’idempotence UUID               |
| Comptes             | États `invite` / `actif` / `inactif` + invitations |
| Sessions            | Empreinte de jeton + expiration                    |

## Équipe

Ce script est destiné à l’équipe **backend** pour initialiser la base partagée entre le back-office et l’interface voyageurs.

Références : MPD v0.3 + Cahier des charges (section 6).

---

## Page d’accueil voyageur

La migration `002_page_accueil.sql` ajoute les objets de lecture nécessaires à
la page d’accueil, sans créer de nouvelle table :

- `v_arrets_publics` — arrêts actifs et non archivés ;
- `v_lignes_publiques` — lignes actives ;
- `v_trajets_publics` — trajets actifs ;
- `v_trajet_arrets_publics` — arrêts ordonnés des trajets ;
- `v_destinations_populaires` — les trois raccourcis de la page d’accueil.

Les destinations populaires sont des **arrêts existants** (`BM:0`, `BM:758`,
`BM:24`, soit Port-Louis, Grand Baie et Curepipe). Leur ordre et leur localité
sont définis dans la vue. Si le produit souhaite ensuite gérer ces destinations
depuis le back-office, on pourra ajouter une table dédiée ou des colonnes de
mise en avant sur `arrets`.

### Application

Depuis la racine du dépôt :

```bash
psql -U postgres -d kotbis -f database/kotbis_schema.sql
psql -U postgres -d kotbis -f database/migrations/002_page_accueil.sql
psql -U postgres -d kotbis -f database/seeds/bus_mauritius.sql
psql -U postgres -d kotbis -f database/tests/page_accueil_test.sql
```

> `kotbis_schema.sql` ne doit être exécuté qu’une seule fois sur une base
> vierge. Sur une base existante, exécuter uniquement la migration et le seed.

### Jeu de données réel

Le seed `bus_mauritius.sql` importe le réseau réel « Bus Mauritius » issu
d'OpenStreetMap :

- 264 lignes (`BM-1`, `BM-2`, …) ;
- 1430 arrêts (`BM:<id_osm>`), dont 1429 actifs ;
- 528 trajets (`BM-T-<hash>`) ;
- 14 350 passages ordonnés (14 342 visibles, l'arrêt `BM:623` étant inactif).

Les coordonnées proviennent d'OpenStreetMap. Les trois destinations populaires
de l'accueil sont `BM:0` (Port-Louis), `BM:758` (Grand Baie) et `BM:24`
(Curepipe).

Le seed retire aussi l'ancien jeu de démonstration (`L001`/`L002`,
`A001`–`A005`, `T001`/`T002`) s'il est encore présent.

### Documentation et contrat API

Toute la documentation du ticket est consolidée dans :

```text
docs/README_page_Acceuil.md
```

Elle contient la liste des données de la page d’accueil, la décision sur les
destinations populaires, les tables et vues utilisées, le contrat API, les
exemples JSON et la checklist de validation Frontend.

La recherche d’itinéraire et l’authentification sont hors périmètre de cette
première version.

# Table `quotas_visiteurs`

Cette table sert à gérer la limite de recherches pour les visiteurs non connectés.

Chaque visiteur non connecté reçoit un jeton UUID. Ce jeton permet à l’API de retrouver son quota sans avoir besoin d’un compte utilisateur.

## Fonctionnement

- Au départ, `nombre_recherches` vaut `0`.
- À chaque recherche réussie, l’API augmente `nombre_recherches` de 1.
- Quand `nombre_recherches` atteint `10`, le visiteur ne peut plus faire de recherche gratuite.
- L’utilisateur doit alors se connecter ou créer un compte pour continuer.
- Il n’y a pas de renouvellement automatique du quota.
- Cette table n’a pas de lien avec la table `comptes`, car elle concerne les visiteurs non connectés.

## Requête utilisée par l’API

Cette requête doit être placée dans le backend, dans la route de recherche utilisée par les visiteurs non connectés :

```sql
UPDATE quotas_visiteurs
SET nombre_recherches = nombre_recherches + 1,
    derniere_recherche_le = now()
WHERE id = $1
  AND nombre_recherches < 10
RETURNING nombre_recherches;
```
