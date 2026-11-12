# KotBis — Documentation du Back-End

## 1. Présentation

Le Back-End de KotBis est responsable du traitement des données,
de la gestion des utilisateurs et de la communication avec la base
de données.

Technologies prévues :
- Node.js 22
- TypeScript
- Express.js (à confirmer par KBE-17)
- PostgreSQL et PostGIS (configuration prévue dans KBE-21)

## 2. Organisation du projet

Le dossier `backend/` contient le code et la configuration du serveur.

### Dossier src/

| Dossier | Rôle |
|---|---|
| configuration | Configuration du serveur et de la base de données |
| middlewares | Vérification des requêtes et gestion des erreurs |
| commun | Fonctions et outils réutilisables |
| authentification | Connexion, inscription et gestion des sessions |
| utilisateurs | Gestion des comptes utilisateurs |
| transport | Gestion des bus et des lignes |
| trajets | Gestion des itinéraires et des trajets |
| localisation | Gestion des positions géographiques |
| estimations | Estimation des temps d'arrivée |
| signalements | Gestion des signalements |
| favoris | Gestion des favoris des utilisateurs |
| alertes | Gestion des alertes et notifications |
| avis | Gestion des avis des utilisateurs |
| administration | Fonctionnalités du Back-Office |

### Autres dossiers

- `tests/` : tests du Back-End.
- `documentation/` : documentation technique du projet.

## 3. Fichiers de configuration

- `package.json` : configuration Node.js et scripts npm.
- `tsconfig.json` : configuration TypeScript.
- `.gitignore` : fichiers exclus du dépôt Git.
- `.env.example` : modèle des variables d'environnement.

## 4. Installation et démarrage

### Prérequis

- Node.js 22 ou supérieur
- npm

### Installation

Depuis le dossier backend :

```bash
npm ci
```

Cette commande installe les dépendances définies dans
package-lock.json.

### Démarrage en développement

```bash
npm run dev
```

Le serveur redémarre automatiquement lorsque le code est modifié.

### Compilation

```bash
npm run build
```

Cette commande compile TypeScript et génère le dossier dist/.

### Démarrage du serveur compilé

```bash
npm start
```

Le serveur démarre par défaut sur le port 3000.

### Vérification

Dans un deuxième terminal :

```bash
curl http://localhost:3000/
```

Réponse attendue :

```json
{
  "message": "Bienvenue sur l'API KotBis",
  "status": "OK"
}
```

Le démarrage et la réponse HTTP ont été testés avec succès
sur l'ordinateur du développeur.

Le test sur un deuxième ordinateur reste à effectuer.

### Configuration

Copier le fichier d'exemple :

```bash
cp .env.example .env
```

Adapter les variables selon l'environnement local.

La connexion PostgreSQL sera configurée dans KBE-21.

## 5. Sécurité

Les mots de passe, jetons et autres informations sensibles
ne doivent jamais être publiés sur GitHub.

Chaque développeur doit utiliser son propre fichier `.env`.

Le fichier `.env.example` sert uniquement de modèle.
