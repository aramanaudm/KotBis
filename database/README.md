# KotBis — Schéma de base de données

## Description

Ce dossier contient le script SQL permettant de **créer la base de données KotBis** (si elle n’existe pas encore) ainsi que toutes ses tables, contraintes, index et vues.

Le fichier `kotbis\_schema.sql` est aligné avec :

* le **Cahier des charges Back-Office \& Base de données MoBis** (section 6)
* le **Modèle Physique de Données (MPD) version 0.3**

## Prérequis

* **PostgreSQL 16** (ou version compatible)
* Un compte PostgreSQL habilité à :

  * créer une base de données
  * activer des extensions (`postgis`, `btree\_gist`, `pgcrypto`)
* Extension **PostGIS 3.4** installée sur le serveur

## Installation

Exécuter le script avec `psql` :

```bash
psql -U postgres -f kotbis\_schema.sql
```

### Comportement du script

1. **Crée la base `kotbis` uniquement si elle n’existe pas déjà**
2. Se connecte à la base (`\\c kotbis`)
3. Active les extensions (PostGIS, btree\_gist, pgcrypto)
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

* `kotbis` (créée seulement si absente)

### Extensions

* `postgis` — données géographiques
* `btree\_gist` — contrainte d’exclusion sur les affectations
* `pgcrypto` — génération d’UUID

### Tables (18)

**Identité \& sécurité**

* `roles` — rôles (voyageur, operateur, moderateur, administrateur)
* `comptes` — connexion (email, hash, état, invitation)
* `personnel` — profils agents back-office
* `voyageurs` — profils voyageurs
* `sessions` — sessions / jetons

**Réseau**

* `lignes` — lignes de bus
* `bus` — véhicules (plaque normalisée)
* `arrets` — arrêts géolocalisés (`geometry(Point, 4326)`)
* `trajets` — trajets (sens)
* `trajet\_arrets` — étapes ordonnées
* `zones` — zones de couverture (`geometry(Polygon, 4326)`)
* `affectations\_bus` — historique bus ↔ trajet (sans chevauchement)

**Contributions**

* `signalements` + `historique\_signalements`
* `avis` + `historique\_avis`

**Points \& Audit**

* `mouvements\_points` — journal append-only (idempotence UUID)
* `journal\_audit` — traces des opérations sensibles

### Index spatiaux (GIST)

* `idx\_arrets\_position`
* `idx\_zones\_contour`

### Vues

* `v\_soldes\_voyageurs`
* `v\_coordonnees\_arrets`
* `v\_affectations\_courantes`
* `v\_indicateurs\_tableau\_de\_bord`

## Points techniques importants

|Sujet|Choix|
|-|-|
|Création de la base|Conditionnelle (ne plante pas si elle existe déjà)|
|Coordonnées|EPSG:4326 (X = longitude, Y = latitude)|
|Soft-delete|`archive\_le TIMESTAMPTZ` (NULL = non archivé)|
|Concurrence|Colonne `version`|
|Affectations|Exclusion GIST (pas de chevauchement)|
|Points|Append-only + clé d’idempotence UUID|
|Comptes|États `invite` / `actif` / `inactif` + invitations|
|Sessions|Empreinte de jeton + expiration|

## Équipe

Ce script est destiné à l’équipe **backend** pour initialiser la base partagée entre le back-office et l’interface voyageurs.

Références : MPD v0.3 + Cahier des charges (section 6).

---

## Page d’accueil voyageur

La migration `002_page_accueil.sql` ajoute les objets de lecture nécessaires à
la page d’accueil, sans créer de nouvelle table :

* `v_arrets_publics` — arrêts actifs et non archivés ;
* `v_lignes_publiques` — lignes actives ;
* `v_trajets_publics` — trajets actifs ;
* `v_trajet_arrets_publics` — arrêts ordonnés des trajets ;
* `v_destinations_populaires` — les trois raccourcis de la page d’accueil.

Les destinations populaires sont des **arrêts existants** (`A001`, `A002`,
`A003`). Leur ordre et leur localité sont définis dans la vue. Si le produit
souhaite ensuite gérer ces destinations depuis le back-office, on pourra
ajouter une table dédiée ou des colonnes de mise en avant sur `arrets`.

### Application

Depuis la racine du dépôt :

```bash
psql -U postgres -d kotbis -f database/kotbis_schema.sql
psql -U postgres -d kotbis -f database/migrations/002_page_accueil.sql
psql -U postgres -d kotbis -f database/seeds/page_accueil.sql
psql -U postgres -d kotbis -f database/tests/page_accueil.sql
```

> `kotbis_schema.sql` ne doit être exécuté qu’une seule fois sur une base
> vierge. Sur une base existante, exécuter uniquement la migration et le seed.

### Données de démonstration

Le seed ajoute :

* 5 arrêts : Gare Victoria, Grand Baie, Moka, Rose-Hill, Curepipe ;
* 2 lignes : `L001`, `L002` ;
* 2 trajets : `T001`, `T002` ;
* les étapes ordonnées des trajets.

Les coordonnées sont fictives et servent uniquement aux tests locaux.

### Documentation et contrat API

Toute la documentation du ticket est consolidée dans :

```text
docs/README.md
```

Elle contient la liste des données de la page d’accueil, la décision sur les
destinations populaires, les tables et vues utilisées, le contrat API, les
exemples JSON et la checklist de validation Frontend.

La recherche d’itinéraire et l’authentification sont hors périmètre de cette
première version.

