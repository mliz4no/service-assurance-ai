import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import customersRouter from "./customers";
import sitesRouter from "./sites";
import servicesRouter from "./services";
import ticketsRouter from "./tickets";
import slaPoliciesRouter from "./sla-policies";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(customersRouter);
router.use(sitesRouter);
router.use(servicesRouter);
router.use(ticketsRouter);
router.use(slaPoliciesRouter);
router.use(usersRouter);
router.use(dashboardRouter);

export default router;
