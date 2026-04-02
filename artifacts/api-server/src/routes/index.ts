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
import controllersRouter from "./controllers";
import devicesRouter from "./devices";
import networkLinksRouter from "./network-links";
import deviceEventsRouter from "./device-events";
import contactsRouter from "./contacts";
import escalationNotificationsRouter from "./escalation-notifications";
import escalationMatrixRouter from "./escalation-matrix";

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
router.use(controllersRouter);
router.use(devicesRouter);
router.use(networkLinksRouter);
router.use(deviceEventsRouter);
router.use(contactsRouter);
router.use(escalationNotificationsRouter);
router.use(escalationMatrixRouter);

export default router;
