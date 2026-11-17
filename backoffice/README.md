# KotBis — Back-office

Interface d’administration du réseau de bus KotBis.

## Statut

Le socle Angular, le shell, la navigation et les 10 routes sont en place. Tous les écrans du
back-office sont disponibles sous forme de **templates Angular complets** : tableaux, filtres,
pagination, exports CSV, modales et formulaires.

Les actions d’ajout, de modification, de suppression, de modération et d’ajustement de points
sont volontairement **non branchées** : elles affichent un message d’aperçu sans modifier les
données. Les services exposent des collections **vides**, prêtes à être alimentées par les
données réelles de la base.

Le CRUD, les appels API et la persistance seront implémentés par l’équipe backend.

## Prérequis

- Node.js compatible avec Angular 22
- npm
- Un navigateur récent

## Installation et démarrage

Depuis le dossier `backoffice` :

```bash
npm install
npm start
```

L’application est disponible sur `http://localhost:4200/`.

## Build et tests

```bash
npm run build
npm test
```

## Qualité

```bash
npm run format
npm run format:check
```

Le projet utilise TypeScript strict, Prettier et Vitest. ESLint sera ajouté à l’étape qualité.

## Structure

```text
src/app/
  core/        services singleton, session, thème
  layout/      shell, sidebar, header, navigation
  shared/      composants réutilisables
  features/    un dossier par domaine
src/environments/
  environment.ts              configuration de production
  environment.development.ts  configuration de développement
```

## Routes

| Écran           | URL                |
| --------------- | ------------------ |
| Tableau de bord | `/tableau-de-bord` |
| Bus             | `/bus`             |
| Arrêts          | `/arrets`          |
| Trajets         | `/trajets`         |
| Zones           | `/zones`           |
| Personnel       | `/personnel`       |
| Utilisateurs    | `/utilisateurs`    |
| Signalements    | `/signalements`    |
| Avis            | `/avis`            |
| Points          | `/points`          |

Toute URL inconnue affiche la page 404.

## API

L’API est développée par l’équipe backend. Le front-end est préparé pour la consommer, mais
utilise pour l’instant des données de démonstration.

- L’URL de base est définie dans les fichiers d’environnement.
- Aucun composant ne doit appeler directement une API : les appels passeront par des services.
- Aucun identifiant de base de données ni secret ne doit être présent dans le front-end.
- Le contrat attendu est décrit dans `../docs/api-contract.md`.

## Références

- Maquette : `https://bus-maurice-voyageurs.sakabelo.chatgpt.site/admin/`
- Cahier des charges back-office : document de conception de la base et des fonctions admin.
