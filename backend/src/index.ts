import express from "express";
import cors from "cors";
import "dotenv/config";
import routeurSante from "./commun/routes/sante.routes";
import {
  verifierConnexionBdd,
  verifierPostgis,
  ErreurBaseDeDonnees,
  obtenirPool
} from "./configuration/baseDeDonnees";
import { DepotAuthentificationPostgres } from "./authentification/depot";
import { ServiceAuthentification } from "./authentification/service";
import { creerRouteurAuthentification } from "./authentification/routes";
import { creerRouteurUtilisateurs } from "./utilisateurs/routes";
import { creerMiddlewareSession } from "./middlewares/authentification";
import { gestionnaireErreurs, routeInconnue } from "./middlewares/gestionErreurs";
import routeurTransport from "./transport/transport.routes";
import { DepotFavorisPostgres } from "./favoris/favoris.depot.postgres";
import { FavorisControleur } from "./favoris/favoris.controleur";
import { creerRoutesFavoris } from "./favoris/favoris.routes";
import { FavorisService } from "./favoris/favoris.service";
import { ReferentielReseauPostgres } from "./favoris/reseau.referentiel.postgres";

import { StockagePartagePostgres } from "./localisation/partage-position.postgres";
import { PartagePositionService } from "./localisation/partage-position.service";
import { PartagePositionController } from "./localisation/partage-position.controller";
import { creerRoutesPartagePosition } from "./localisation/partage-position.routes";


const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

app.use("/api/sante", routeurSante);
app.use("/api", routeurTransport);

// KBE-23 : authentification par sessions stockées en base (jeton opaque)
const serviceAuthentification = new ServiceAuthentification(
  new DepotAuthentificationPostgres(obtenirPool)
);
const middlewareSession = creerMiddlewareSession(serviceAuthentification);
app.use("/api", creerRouteurAuthentification(serviceAuthentification, middlewareSession));


// KBE-32 : démarrage et arrêt du partage de position
const stockagePartage = new StockagePartagePostgres(obtenirPool());
const servicePartage = new PartagePositionService(stockagePartage);
const controllerPartage = new PartagePositionController(servicePartage);

app.use(
  "/api/localisation/partage",
  creerRoutesPartagePosition(controllerPartage, middlewareSession)
);


// KBE-40 : favoris du voyageur connecté
app.use(
  "/api/favoris",
  creerRoutesFavoris(
    middlewareSession,
    new FavorisControleur(
      new FavorisService(new DepotFavorisPostgres(obtenirPool), new ReferentielReseauPostgres())
    )
  )
);

// KBE-25 / KBE-26 : profil, avatar, e-mail, mot de passe et demande de suppression
app.use("/api/utilisateurs", creerRouteurUtilisateurs(serviceAuthentification, middlewareSession));

app.get("/", (req, res) => {
  res.json({
    message: "Bienvenue sur l'API KotBis",
    status: "OK"
  });
});

app.use(routeInconnue);
app.use(gestionnaireErreurs);

// Démarrage du serveur
app.listen(PORT, async () => {
  console.log(`Serveur KotBis démarré sur le port ${PORT}`);

  // Vérification de la connexion PostgreSQL ; aucun secret n'est affiché en cas d'échec
  try {
    await verifierConnexionBdd();
    console.log("[BDD] Connexion PostgreSQL réussie");
    const versionPostgis = await verifierPostgis();
    console.log(`[BDD] PostGIS disponible (version ${versionPostgis})`);
  } catch (erreur) {
    if (erreur instanceof ErreurBaseDeDonnees) {
      console.error(`[BDD] ${erreur.message} (code : ${erreur.code ?? "inconnu"})`);
    } else {
      console.error(`[BDD] ${(erreur as Error).message}`);
    }
  }
});
