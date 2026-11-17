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

