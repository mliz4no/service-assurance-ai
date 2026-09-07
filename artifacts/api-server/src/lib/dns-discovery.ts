import { db, dnsCandidatesTable, type DnsCandidate } from '@workspace/db';
import { monitoredTargetsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import dns from 'node:dns';

export const CURATED_PUBLIC_DNS = [
  { providerName: 'Cloudflare', address: '1.1.1.1', sourceUrl: 'https://one.one.one.one/' },
  { providerName: 'Cloudflare', address: '1.0.0.1', sourceUrl: 'https://one.one.one.one/' },
  { providerName: 'Google Public DNS', address: '8.8.8.8', sourceUrl: 'https://developers.google.com/speed/public-dns' },
  { providerName: 'Google Public DNS', address: '8.8.4.4', sourceUrl: 'https://developers.google.com/speed/public-dns' },
  { providerName: 'Quad9', address: '9.9.9.9', sourceUrl: 'https://quad9.net/service/service-addresses-and-features/' },
  { providerName: 'Quad9', address: '149.112.112.112', sourceUrl: 'https://quad9.net/service/service-addresses-and-features/' },
  { providerName: 'Cisco OpenDNS', address: '208.67.222.222', sourceUrl: 'https://www.opendns.com/setupguide/' },
  { providerName: 'Cisco OpenDNS', address: '208.67.220.220', sourceUrl: 'https://www.opendns.com/setupguide/' },
] as const;

export async function importCuratedPublicDns(): Promise<DnsCandidate[]> {
  const imported: DnsCandidate[] = [];
  for (const candidate of CURATED_PUBLIC_DNS) {
    const [row] = await db
      .insert(dnsCandidatesTable)
      .values({
        ...candidate,
        transport: 'udp',
        port: 53,
        country: 'US',
        source: 'provider_documentation',
        status: 'pending',
      })
      .onConflictDoUpdate({
        target: [dnsCandidatesTable.address, dnsCandidatesTable.transport],
        set: { providerName: candidate.providerName, sourceUrl: candidate.sourceUrl, updatedAt: new Date() },
      })
      .returning();
    imported.push(row);
  }
  return imported;
}

export async function markDnsCandidateStatus(
  id: string,
  status: DnsCandidate['status'],
  validationMessage?: string,
): Promise<DnsCandidate | undefined> {
  const [updated] = await db
    .update(dnsCandidatesTable)
    .set({ status, validationMessage, lastValidatedAt: new Date(), updatedAt: new Date() })
    .where(eq(dnsCandidatesTable.id, id))
    .returning();
  return updated;
}

export async function validateDnsCandidate(id: string): Promise<DnsCandidate | undefined> {
  const [candidate] = await db.select().from(dnsCandidatesTable).where(eq(dnsCandidatesTable.id, id));
  if (!candidate) return undefined;

  const startedAt = Date.now();
  const resolver = new dns.promises.Resolver();
  resolver.setServers([candidate.address]);
  try {
    const answers = await resolver.resolve4('example.com');
    return markDnsCandidateStatus(
      id,
      answers.length > 0 ? 'validated' : 'rejected',
      `Resolved example.com with ${answers.length} A record(s) in ${Date.now() - startedAt}ms`,
    );
  } catch (error) {
    return markDnsCandidateStatus(
      id,
      'rejected',
      error instanceof Error ? error.message : 'DNS validation failed',
    );
  }
}

export async function promoteDnsCandidate(id: string): Promise<{ candidate: DnsCandidate; targetId: string } | undefined> {
  const [candidate] = await db.select().from(dnsCandidatesTable).where(eq(dnsCandidatesTable.id, id));
  if (!candidate || candidate.status !== 'validated') return undefined;

  const [target] = await db
    .insert(monitoredTargetsTable)
    .values({
      name: `${candidate.providerName} DNS (${candidate.address})`,
      hostOrIp: candidate.address,
      targetType: 'ip',
      preferredCheckType: 'dns',
      checkPort: candidate.port,
      checkConfig: { dnsRecordType: 'A', dnsServers: [candidate.address], dnsQueryHost: 'example.com' },
      probeAllowlisted: true,
      provider: candidate.providerName,
      region: candidate.country,
      status: 'unknown',
      statusSource: 'manual',
    })
    .onConflictDoNothing({ target: monitoredTargetsTable.hostOrIp })
    .returning({ id: monitoredTargetsTable.id });

  const [promotedTarget] = target
    ? [target]
    : await db
        .select({ id: monitoredTargetsTable.id })
        .from(monitoredTargetsTable)
        .where(eq(monitoredTargetsTable.hostOrIp, candidate.address));
  if (!promotedTarget) return undefined;

  const [promoted] = await db
    .update(dnsCandidatesTable)
    .set({ status: 'promoted', updatedAt: new Date() })
    .where(eq(dnsCandidatesTable.id, id))
    .returning();
  return promoted ? { candidate: promoted, targetId: promotedTarget.id } : undefined;
}