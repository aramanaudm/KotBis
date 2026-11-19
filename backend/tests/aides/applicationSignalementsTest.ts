import express from "express";
import { ServiceAuthentification } from "../../src/authentification/service";
import { creerRouteurAuthentification } from "../../src/authentification/routes";
import { creerMiddlewareSession } from "../../src/middlewares/authentification";
import { gestionnaireErreurs, routeInconnue } from "../../src/middlewares/gestionErreurs";
import { SignalementsController } from "../../src/signalements/signalements.controller";
import { creerRoutesSignalements } from "../../src/signalements/signalements.routes";
import { ServiceSignalements } from "../../src/signalements/signalements.service";
import { FauxDepot } from "./fauxDepot";
import { FauxDepotSignalements } from "./fauxDepotSignalements";

export function creerApplicationSignalementsTest() {
  const depotAuth = new FauxDepot();
  const serviceAuth = new ServiceAuthentification(depotAuth, { dureeSessionMinutes: 60 });
  const middlewareSession = creerMiddlewareSession(serviceAuth);
  const depotSignalements = new FauxDepotSignalements();
  const serviceSignalements = new ServiceSignalements(depotSignalements);
  const controllerSignalements = new SignalementsController(serviceSignalements);
  const application = express();

  application.use(express.json({ limit: "100kb" }));
  application.use("/api", creerRouteurAuthentification(serviceAuth, middlewareSession));
  application.use(
    "/api/signalements",
    creerRoutesSignalements(controllerSignalements, middlewareSession)
  );
  application.use(routeInconnue);
  application.use(gestionnaireErreurs);

  return { application, depotAuth, serviceAuth, depotSignalements, serviceSignalements };
}
