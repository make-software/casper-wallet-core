import fs from 'fs';
import path from 'path';

/**
 * Two static import-graph gates.
 *
 * The first: the helpers a wallet client calls while rendering its home screen must not reach
 * `casper-js-sdk`. The SDK ships one prebuilt UMD bundle with no ESM build and no `sideEffects`
 * flag, so a single value import links ~900 KB no bundler can shake back out. `import type` /
 * `export type` are ignored — TypeScript and Babel both erase them.
 *
 * The second: the optional Ledger packages. They are optional peers and this package ships raw
 * TypeScript, so a consumer that skips them compiles our sources without them — there a type-only
 * import fails just as hard as a value one, and the walk counts both.
 */

const REPO_ROOT = path.resolve(__dirname, '..');

/** Modules a client can import to render a home screen without linking the SDK. */
const SDK_FREE_ENTRY_POINTS = [
  'src/utils/casperSdk/accountHash.ts',
  'src/utils/casperSdk/network.ts',
  'src/utils/casperSdk/blockExplorer.ts',
  'src/domain/constants/casperNetwork.ts',
  // The whole domain layer: entities, contracts and constants only. Both wallet clients
  // deep-import this barrel from render-path modules.
  'src/domain/index.ts',
  // The data repositories a home screen renders from. `src/setup.ts` builds the signing
  // repositories too and links the SDK by design; this is the half that must not.
  'src/setupData.ts',
  // The React hook layer, documented in the README as deep-importable without the SDK: its
  // repository dependencies arrive as injected interfaces.
  'src/react/index.ts',
];

interface Import {
  specifier: string;
  typeOnly: boolean;
}

// `import ... from 'x'`, `export ... from 'x'`, and bare `import 'x'`.
const IMPORT_PATTERN =
  /(?:^|[\n;])\s*(?:import|export)\s+(?:([\s\S]*?)\s+from\s*)?['"]([^'"]+)['"]/g;

const parseImports = (source: string): Import[] => {
  const imports: Import[] = [];

  for (const [, clause, specifier] of source.matchAll(IMPORT_PATTERN)) {
    // `import type { X } from` / `export type { X } from` — erased at compile time.
    // A mixed `import { type X, Y }` keeps `Y`, so it is deliberately counted as a value import.
    const typeOnly = /^type\s/.test(clause ?? '');
    imports.push({ specifier, typeOnly });
  }

  return imports;
};

/** Resolves a relative specifier the way `moduleResolution: nodenext` does for this repo's source. */
const resolveRelative = (fromFile: string, specifier: string): string | null => {
  // nodenext-style `./foo.js` specifiers point at `./foo.ts` in source.
  const target = path.resolve(path.dirname(fromFile), specifier.replace(/\.js$/, ''));

  for (const candidate of [`${target}.ts`, path.join(target, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
};

/**
 * Every module reachable from `entryPoint`, keyed by repo-relative path, valued by the packages it
 * imports. With `includeTypeOnly`, `import type` edges count too — for both the walk and the
 * recorded packages.
 */
const collectGraph = (entryPoint: string, includeTypeOnly = false): Map<string, string[]> => {
  const graph = new Map<string, string[]>();
  const queue = [path.resolve(REPO_ROOT, entryPoint)];

  while (queue.length > 0) {
    const file = queue.shift() as string;
    const relative = path.relative(REPO_ROOT, file);

    if (graph.has(relative)) {
      continue;
    }

    const packages: string[] = [];
    graph.set(relative, packages);

    for (const { specifier, typeOnly } of parseImports(fs.readFileSync(file, 'utf8'))) {
      if (typeOnly && !includeTypeOnly) {
        continue;
      }

      if (!specifier.startsWith('.')) {
        packages.push(specifier);
        continue;
      }

      const resolved = resolveRelative(file, specifier);

      if (resolved === null) {
        throw new Error(`Unresolved import "${specifier}" in ${relative}`);
      }

      queue.push(resolved);
    }
  }

  return graph;
};

describe('SDK-free modules', () => {
  it.each(SDK_FREE_ENTRY_POINTS)('%s does not reach casper-js-sdk at runtime', entryPoint => {
    const graph = collectGraph(entryPoint);

    const offenders = [...graph]
      .filter(([, packages]) => packages.includes('casper-js-sdk'))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  it('resolves the whole graph (guards against the walker silently finding nothing)', () => {
    expect(collectGraph('src/utils/casperSdk/blockExplorer.ts').size).toBeGreaterThan(1);
  });

  it('still detects the SDK where it is legitimately used', () => {
    const graph = collectGraph('src/utils/casperSdk/cep-nft-transfer.ts');

    expect([...graph.values()].flat()).toContain('casper-js-sdk');
  });
});

/** Installed only by clients that use the Ledger integration; see `ICasperLedgerServiceOptions`. */
const OPTIONAL_LEDGER_PACKAGES = ['@ledgerhq/hw-transport', '@zondax/ledger-casper'];

/** Entry points a client reaches without opting into Ledger — the package root included. */
const LEDGER_FREE_ENTRY_POINTS = ['index.ts', 'src/domain/index.ts', 'src/setup.ts'];

describe('optional Ledger packages', () => {
  it.each(LEDGER_FREE_ENTRY_POINTS)(
    '%s does not import them, type imports included',
    entryPoint => {
      const graph = collectGraph(entryPoint, true);

      const offenders = [...graph]
        .filter(([, packages]) => packages.some(pkg => OPTIONAL_LEDGER_PACKAGES.includes(pkg)))
        .map(([file]) => file);

      expect(offenders).toEqual([]);
    },
  );

  it('still detects them in the file that checks the vendor types', () => {
    const graph = collectGraph('src/data/ledger/vendor-contracts.test.ts', true);

    expect([...graph.values()].flat()).toEqual(expect.arrayContaining(OPTIONAL_LEDGER_PACKAGES));
  });
});
