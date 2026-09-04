import fs from 'fs';
import path from 'path';

import {
  CORE_ERROR_MESSAGE_KEYS as ROOT_CORE_ERROR_MESSAGE_KEYS,
  CoreErrorMessageKey,
} from '../../../index';

import { CORE_ERROR_MESSAGE_KEYS } from './error-keys';

const SRC_ROOT = path.resolve(__dirname, '../..');
const KEY_PATTERN = /'(errors:[a-z0-9-]+)'/g;
// The catalogue lists every key as a literal, so scanning it would make the stray case vacuous.
const CATALOGUE_FILE = path.join(SRC_ROOT, 'domain', 'common', 'error-keys.ts');

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(full);
    }

    return entry.name.endsWith('.ts') && !entry.name.includes('.test.') && full !== CATALOGUE_FILE
      ? [full]
      : [];
  });

const literalsInSource = (): Map<string, string> => {
  const found = new Map<string, string>();

  for (const file of walk(SRC_ROOT)) {
    const source = fs.readFileSync(file, 'utf8');

    for (const [, key] of source.matchAll(KEY_PATTERN)) {
      if (!found.has(key)) {
        found.set(key, path.relative(SRC_ROOT, file));
      }
    }
  }

  return found;
};

describe('CORE_ERROR_MESSAGE_KEYS', () => {
  it('lists every errors:* literal in the source', () => {
    const missing = [...literalsInSource()]
      .filter(([key]) => !CORE_ERROR_MESSAGE_KEYS.includes(key as never))
      .map(([key, file]) => `${key} (${file})`);

    expect(missing).toEqual([]);
  });

  it('lists nothing that the source does not use', () => {
    const found = literalsInSource();
    // The flow keys are built by template and never appear as literals; assert them separately.
    const templated = ['errors:flow-runner-account-mismatch'];
    const strays = CORE_ERROR_MESSAGE_KEYS.filter(
      key => !found.has(key) && !templated.includes(key),
    );

    expect(strays).toEqual([]);
  });

  it('is exported from the package root as a literal union', () => {
    expect(ROOT_CORE_ERROR_MESSAGE_KEYS).toBe(CORE_ERROR_MESSAGE_KEYS);
    expect(ROOT_CORE_ERROR_MESSAGE_KEYS.length).toBeGreaterThan(0);

    const member: CoreErrorMessageKey = 'errors:unexpected';
    // @ts-expect-error a widened `string` here would stop consumers' copy maps being checkable
    const nonMember: CoreErrorMessageKey = 'not-a-core-key';

    expect(ROOT_CORE_ERROR_MESSAGE_KEYS).toContain(member);
    expect(ROOT_CORE_ERROR_MESSAGE_KEYS).not.toContain(nonMember);
  });

  it('covers every FlowErrorType expansion', () => {
    const flowTypes = ['runner-account-mismatch'];

    for (const type of flowTypes) {
      expect(CORE_ERROR_MESSAGE_KEYS).toContain(`errors:flow-${type}`);
    }
  });
});
