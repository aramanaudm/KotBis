# KotBis — Backend API

Ce document décrit l'état actuel du Back-End de l'application **KotBis**, les dépendances installées, la configuration requise, et les procédures pour tester les routes d'authentification.

## 🛠️ Prérequis

Avant de lancer le projet, assurez-vous d'avoir installé :
*   **Node.js** (version 18 ou supérieure)
*   **PostgreSQL** avec l'extension **PostGIS**
*   Un client API comme **Postman**, **Insomnia** ou **Thunder Client** (extension VS Code)

## 📦 Installation des dépendances

Les dépendances suivantes ont été installées pour faire fonctionner le serveur, la base de données et la sécurité :

```bash
# Dépendances principales (Serveur & Base de données)
npm install express pg cors dotenv

# Dépendance pour la sécurité (Hachage Argon2id)
npm install argon2

# Dépendance pour l'authentification par Token (JWT)
npm install jsonwebtoken

# Dépendances de développement (Types TypeScript)
npm install --save-dev @types/express @types/pg @types/cors @types/node @types/jsonwebtoken
```

## ⚙️ Configuration de l'environnement

Créez un fichier `.env` à la racine du dossier `backend/` (ou copiez le fichier `.env.example`) et remplissez les variables suivantes :

```env
# Port du serveur
PORT=3000

# Connexion PostgreSQL
DATABASE_URL=postgresql://votre_utilisateur:votre_mot_de_passe@localhost:5432/kotbis

# Secret pour la signature des Tokens JWT (mettez une phrase longue et complexe)
JWT_SECRET=une_phrase_tres_longue_et_compliquee_pour_kotbis
```

## 🚀 Lancement du serveur

Pour démarrer le serveur en mode développement (avec rechargement automatique à chaque modification) :

```bash
npm run dev
```

Le terminal doit afficher les messages de succès suivants :

```text
Serveur KotBis démarré sur le port 3000
[BDD] Connexion PostgreSQL réussie
[BDD] PostGIS disponible (version 3.4.2)
```

---

## 🧪 Tests de l'API avec Postman

Voici les étapes pour tester les fonctionnalités d'authentification et de gestion de compte.

### 1. Inscription (`POST /api/inscription`)
Cette route insère les données dans les tables `comptes` et `voyageurs` de manière sécurisée (Transaction SQL). Le mot de passe est haché avec Argon2id.

*   **Méthode :** `POST`
*   **URL :** `http://localhost:3000/api/inscription`
*   **Onglet "Body" (raw -> JSON) :**
```json
{
  "pseudo": "maya974",
  "email": "maya@email.com",
  "motDePasse": "monSuperMotDePasse123"
}
```
*   **Résultat attendu :** `201 Created` avec un JSON contenant l'ID, le pseudo et l'email.
*   **Test d'erreur :** Relancez la requête avec le même email. Vous devez recevoir une erreur `409 Conflict`.

### 2. Connexion (`POST /api/connexion`)
Cette route vérifie les identifiants et génère un Token JWT valide pendant 24h.

*   **Méthode :** `POST`
*   **URL :** `http://localhost:3000/api/connexion`
*   **Onglet "Body" (raw -> JSON) :**
```json
{
  "identifiant": "maya@email.com", 
  "motDePasse": "monSuperMotDePasse123"
}
```
*(Note : "identifiant" accepte l'email OU le pseudo).*

*   **Résultat attendu :** `200 OK`. **Copiez le token** reçu dans la réponse. Il sera nécessaire pour les tests suivants.

### 3. Modification de profil (`PUT /api/utilisateurs/moi`) 🔒
*Requiert une authentification.*

*   **Méthode :** `PUT`
*   **URL :** `http://localhost:3000/api/utilisateurs/moi`
*   **Onglet "Authorization" :** Sélectionnez `Bearer Token` et collez votre token.
*   **Onglet "Body" (raw -> JSON) :**
```json
{
  "pseudo": "maya_nouveau_pseudo",
  "email": "nouvel_email@email.com"
}
```
*   **Résultat attendu :** `200 OK`. Modifie les données dans `comptes` (email) et `voyageurs` (pseudo).

### 4. Suppression de compte (`DELETE /api/utilisateurs/moi`) 🔒
*Requiert une authentification.*

*   **Méthode :** `DELETE`
*   **URL :** `http://localhost:3000/api/utilisateurs/moi`
*   **Onglet "Authorization" :** Sélectionnez `Bearer Token` et collez votre token.
*   **Résultat attendu :** `200 OK`. Supprime le compte des tables `comptes` et `voyageurs`.

### 5. Tests de sécurité (Routes protégées)
Pour vérifier que la sécurité est bien en place :
*   Appelez `PUT /api/utilisateurs/moi` **sans** token. Résultat attendu : `401 Unauthorized` ("Token manquant ou invalide").
*   Appelez la même route avec un faux token (ex: `Bearer faux_token`). Résultat attendu : `401 Unauthorized` ("Token expiré ou invalide").

---

## 🔒 Sécurité et Architecture

*   **Hachage Argon2id :** Les mots de passe ne sont jamais stockés en clair. Le hachage est effectué avant insertion en base.
*   **Transactions SQL :** L'inscription utilise une transaction (`BEGIN` / `COMMIT` / `ROLLBACK`) pour garantir qu'un compte (`comptes`) et son profil (`voyageurs`) sont créés ensemble ou annulés en cas d'erreur.
*   **Authentification JWT :** Les routes de modification et de suppression sont protégées par un Middleware (`verifierToken`). L'ID de l'utilisateur est extrait directement du Token, ce qui empêche un utilisateur de modifier ou supprimer le compte d'un autre en changeant l'URL.
*   **Alignement BDD :** Le code utilise strictement les tables `comptes` et `voyageurs` définies dans le script `kotbis_schema.sql` fourni par l'équipe Back-Office.

## 📂 Structure du projet

*   `src/index.ts` : Point d'entrée de l'application (Express) avec les routes d'authentification et les middlewares.
*   `src/configuration/baseDeDonnees.ts` : Configuration et vérification de la connexion à PostgreSQL/PostGIS.
*   `src/commun/crud-reflect.ts` : Module de génération de requêtes SQL par réflexion (utilisé pour l'administration et les tests).
*   `documentation/` : Contient les cahiers des charges et guides de l'équipe.
*   `tests/` : Tests unitaires et d'intégration (`npm test`).
```
