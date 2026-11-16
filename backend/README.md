# KotBis — Backend API

Ce document décrit l'état actuel du Back-End de l'application **KotBis**, les dépendances installées, la configuration requise, et les procédures pour tester les routes d'authentification (Inscription et Connexion).

## 🛠️ Prérequis

Avant de lancer le projet, assurez-vous d'avoir installé :
*   **Node.js** (version 18 ou supérieure)
*   **PostgreSQL** avec l'extension **PostGIS**
*   Un client API comme **Postman**, **Insomnia** ou **Thunder Client** (extension VS Code)

## 📦 Installation des dépendances

Les dépendances suivantes ont été installées pour faire fonctionner le serveur, la base de données et la sécurité (hachage des mots de passe) :

```bash
# Dépendances principales (Serveur & Base de données)
npm install express pg cors dotenv

# Dépendance pour la sécurité (Hachage Argon2id)
npm install argon2

# Dépendance pour l'authentification par Token (JWT)
npm install jsonwebtoken

# Dépendances de développement (Types TypeScript)
npm install --save-dev @types/express @types/pg @types/cors @types/node @types/jsonwebtoken