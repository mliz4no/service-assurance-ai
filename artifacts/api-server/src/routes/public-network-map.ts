import { Router, type IRouter } from 'express';
import {
  getPublicNetworkMapData,
  getPublicNetworkMapSummary,
  getPublicOutageRegions,
} from '../lib/outage-map';

const router: IRouter = Router();

router.get('/public/network-map', async (_req, res): Promise<void> => {
  const data = await getPublicNetworkMapData();
  res.json(data);
});

router.get('/public/network-map/summary', async (_req, res): Promise<void> => {
  const summary = await getPublicNetworkMapSummary();
  res.json(summary);
});

router.get('/public/network-map/regions', async (_req, res): Promise<void> => {
  const regions = await getPublicOutageRegions();
  res.json(regions);
});

export default router;
