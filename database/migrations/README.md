# KotBis — Migrations de la base de données

Ce dossier contient les **migrations versionnées** appliquées après le schéma initial
`database/kotbis_schema.sql` (EF-BDD-007 : les changements du schéma passent par des migrations
versionnées).

## Règles

* Une migration = un fichier `NNN_description.sql`, numéroté dans l'ordre d'application.
* Les migrations s'appliquent **dans l'ordre des numéros**, après `kotbis_schema.sql`.
* Une migration déjà partagée ne se modifie pas : une correction passe par une nouvelle migration.
* Chaque script est **transactionnel** (`BEGIN` … `COMMIT`) : en cas d'erreur, rien n'est appliqué.
* Chaque script est **idempotent** : il peut être relancé sans erreur ni perte de données.
* Toute nouvelle migration est relue par l'équipe BDD avant fusion.

## Liste des migrations

| N°  | Fichier                     | Ticket          | Objet                                                    |
|-----|-----------------------------|-----------------|----------------------------------------------------------|
| 001 | `001_authentification.sql`  | KBE-22 / KBE-49 | Ajoute `voyageurs.telephone` (téléphone facultatif)      |

---

## 001 — Authentification des voyageurs

### Pourquoi

L'inscription des voyageurs (KBE-22, `backend/src/authentification/depot.ts`) enregistre le
téléphone facultatif dans la colonne `voyageurs.telephone`. Cette colonne n'existe pas dans
`kotbis_schema.sql`. Sans elle, **toute inscription échoue**, même sans téléphone saisi :

```
PostgreSQL 42703 : column "telephone" of relation "voyageurs" does not exist
→ API : HTTP 500 sur POST /api/inscription
```

### Ce que fait le script

| Élément                    | Détail                                                                 |
|----------------------------|------------------------------------------------------------------------|
| Colonne                    | `voyageurs.telephone VARCHAR(20)`, `NULL` = non renseigné              |
| Contrainte                 | `chk_voyageurs_telephone` : format contrôlé aussi en base              |

La contrainte reprend la validation de l'API (`backend/src/authentification/validation.ts`) :

* facultatif (`NULL` accepté) ;
* 6 à 20 caractères : chiffres, espaces, `+` en tête, `(`, `)`, `.` et `-` ;
* au moins 6 chiffres.

| Exemple                     | Résultat  |
|-----------------------------|-----------|
| `+230 5555 1234`            | accepté   |
| `(230) 5-123.456`           | accepté   |
| `NULL`                      | accepté   |
| `abc123`                    | refusé    |
| `12345` (moins de 6 chiffres) | refusé  |
| plus de 20 caractères       | refusé    |

> La ville (« Ville ou zone » dans le formulaire) **n'a pas besoin de migration** : elle est
> enregistrée dans la colonne existante `voyageurs.zone_libre`. L'API accepte les noms
> `zoneLibre`, `city` ou `ville` et les écrit tous dans `zone_libre`.

### Prérequis

* Base `kotbis` créée avec `database/kotbis_schema.sql`.
* Rôles de base insérés (voir `database/README.md`). L'inscription impose le rôle `voyageur`
  et échoue s'il est absent ; cette migration ne les crée pas.

### Appliquer

Depuis la racine du dépôt :

```bash
psql -U postgres -d kotbis -f database/migrations/001_authentification.sql
```

Sous Windows (PowerShell), si `psql` n'est pas dans le PATH :

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d kotbis -f database/migrations/001_authentification.sql
```

Sortie attendue :

```
BEGIN
ALTER TABLE
DO
COMMIT
```

Relancé une seconde fois, le script affiche
`NOTICE: column "telephone" of relation "voyageurs" already exists, skipping` : c'est normal.

### Vérifier

```bash
psql -U postgres -d kotbis -c "\d voyageurs"
```

La liste doit contenir `telephone | character varying(20)` et la contrainte
`chk_voyageurs_telephone`.