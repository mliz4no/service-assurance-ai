import { Router, type IRouter } from 'express';
import { getPublicNetworkMapData, getPublicNetworkMapSummary } from '../lib/outage-map';

const router: IRouter = Router();

router.get('/public/network-map', async (_req, res): Promise<void> => {
  const data = await getPublicNetworkMapData();
  res.json(data);
});

router.get('/public/network-map/summary', async (_req, res): Promise<void> => {
  const summary = await getPublicNetworkMapSummary();
  res.json(summary);
});

export default router;