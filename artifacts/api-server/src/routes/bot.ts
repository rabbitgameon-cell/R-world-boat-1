import { Router } from "express";
import { getBotInfo } from "../bot/index";

const botRouter = Router();

botRouter.get("/bot/status", (_req, res) => {
  res.json(getBotInfo());
});

export default botRouter;
