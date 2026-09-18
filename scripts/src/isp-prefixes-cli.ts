import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import {
  getAnnouncedPrefixes,
  selectPingCandidates,
  verifyIspAsns,
  type AnnouncedPrefix,
  type IspAsn,
} from './isp-prefixes';

type CliCommand = 'verify' | 'prefixes' | 'targets';

function cliOption(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function cliNumberOption(args: string[], name: string, fallback: number): number {
  const parsed = Number(cliOption(args, name, String(fallback)));
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`);
  return parsed;
}

async function readCsv<T extends Record<string, string>>(path: string): Promise<T[]> {
  return parse(await readFile(path, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
}

async function writeCsv(
  path: string,
  records: Record<string, unknown>[],
  columns: string[],
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stringify(records, { header: true, columns }), 'utf8');
}

async function main(args = process.argv.slice(2)): Promise<void> {
  const command = args[0] as CliCommand | undefined;
  if (!command || !['verify', 'prefixes', 'targets'].includes(command)) {
    throw new Error('Usage: isp-prefixes <verify|prefixes|targets> [options]');
  }

  if (command === 'verify') {
    const rows = await readCsv<IspAsn & Record<string, string>>(
      resolve(cliOption(args, '--asns', 'data/isp_asns.csv')),
    );
    process.stdout.write(stringify(await verifyIspAsns(rows), { header: true }));
    return;
  }

  if (command === 'prefixes') {
    const rows = await readCsv<IspAsn & Record<string, string>>(
      resolve(cliOption(args, '--asns', 'data/isp_asns.csv')),
    );
    const outputPath = resolve(cliOption(args, '--out', 'output/isp_prefixes.csv'));
    const results = await getAnnouncedPrefixes(rows, { ipv4Only: !args.includes('--include-ipv6') });
    await writeCsv(outputPath, results, [
      'isp', 'asn', 'category', 'prefix', 'addressFamily', 'numAddresses',
    ]);
    process.stderr.write(`Wrote ${results.length} announced prefixes to ${outputPath}\n`);
    return;
  }

  const prefixes = await readCsv<AnnouncedPrefix & Record<string, string>>(
    resolve(cliOption(args, '--prefixes', 'output/isp_prefixes.csv')),
  );
  const outputPath = resolve(cliOption(args, '--out', 'output/targets.csv'));
  const results = selectPingCandidates(prefixes, {
    perPrefix: cliNumberOption(args, '--per-prefix', 1),
    minimumPrefixLength: cliNumberOption(args, '--min-prefix-len', 20),
    maxCandidates: cliNumberOption(args, '--max-candidates', 100),
  });
  await writeCsv(outputPath, results, ['isp', 'asn', 'category', 'prefix', 'candidateIp']);
  process.stderr.write(
    `Wrote ${results.length} unprobed candidates to ${outputPath}; review and allowlist before monitoring.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});