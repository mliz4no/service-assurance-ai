import { Router, type IRouter } from "express";
import { db, networkLinksTable, managedDevicesTable, customersTable, sitesTable, servicesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/network-links", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === "telecom_services_partner") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { customerId, siteId, status, role, search } = req.query as Record<string, string>;

  let links = await db.select().from(networkLinksTable);

  if (customerId) links = links.filter((l) => l.customerId === customerId);
  if (siteId) links = links.filter((l) => l.siteId === siteId);
  if (status) links = links.filter((l) => l.status === status);
  if (role) links = links.filter((l) => l.role === role);
  if (search) {
    const q = search.toLowerCase();
    links = links.filter(
      (l) =>
        l.linkName.toLowerCase().includes(q) ||
        (l.providerName ?? "").toLowerCase().includes(q) ||
        (l.circuitId ?? "").toLowerCase().includes(q)
    );
  }

  const deviceIds = [...new Set(links.map((l) => l.managedDeviceId))];
  const customerIds = [...new Set(links.map((l) => l.customerId).filter(Boolean))] as string[];
  const siteIds = [...new Set(links.map((l) => l.siteId).filter(Boolean))] as string[];
  const serviceIds = [...new Set(links.map((l) => l.serviceId).filter(Boolean))] as string[];

  const [devices, customers, sites, services] = await Promise.all([
    deviceIds.length ? db.select().from(managedDevicesTable).where(or(...deviceIds.map((id) => eq(managedDevicesTable.id, id)))) : [],
    customerIds.length ? db.select().from(customersTable).where(or(...customerIds.map((id) => eq(customersTable.id, id)))) : [],
    siteIds.length ? db.select().from(sitesTable).where(or(...siteIds.map((id) => eq(sitesTable.id, id)))) : [],
    serviceIds.length ? db.select().from(servicesTable).where(or(...serviceIds.map((id) => eq(servicesTable.id, id)))) : [],
  ]);

  const enriched = links.map((l) => ({
    ...l,
    device: devices.find((d) => d.id === l.managedDeviceId) ?? null,
    customer: customers.find((c) => c.id === l.customerId) ?? null,
    site: sites.find((s) => s.id === l.siteId) ?? null,
    service: services.find((s) => s.id === l.serviceId) ?? null,
  }));

  res.json(enriched);
});

router.get("/network-links/:id", requireAuth, async (req, res): Promise<void> => {
  const [link] = await db.select().from(networkLinksTable).where(eq(networkLinksTable.id, req.params.id));
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const [device, customer, site, service] = await Promise.all([
    db.select().from(managedDevicesTable).where(eq(managedDevicesTable.id, link.managedDeviceId)).then((r) => r[0] ?? null),
    link.customerId ? db.select().from(customersTable).where(eq(customersTable.id, link.customerId)).then((r) => r[0] ?? null) : Promise.resolve(null),
    link.siteId ? db.select().from(sitesTable).where(eq(sitesTable.id, link.siteId)).then((r) => r[0] ?? null) : Promise.resolve(null),
    link.serviceId ? db.select().from(servicesTable).where(eq(servicesTable.id, link.serviceId)).then((r) => r[0] ?? null) : Promise.resolve(null),
  ]);

  res.json({ ...link, device, customer, site, service });
});

export default router;
