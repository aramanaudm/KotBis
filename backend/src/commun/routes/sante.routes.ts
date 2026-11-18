import { Router } from "express";

const routeurSante = Router();

routeurSante.get("/", (_req, res) => {
    res.status(200).json({
        statut: "OK",
        service: "KotBis Back-End",
        horodatage: new Date().toISOString()
    });
});

export default routeurSante;