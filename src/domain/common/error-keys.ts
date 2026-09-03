/**
 * Every i18n key core can put in an error's `message`. Core ships no copy: a consumer maps these
 * to its own strings, and {@link CoreErrorMessageKey} makes an incomplete map a type error.
 *
 * Kept exhaustive by `error-keys.test.ts`, which scans `src/` for `errors:*` literals.
 */
export const CORE_ERROR_MESSAGE_KEYS = [
  'errors:already-signed',
  'errors:cancel-request-error',
  'errors:client-validation',
  'errors:connection-error',
  'errors:deploy-rpc-error',
  'errors:empty-signature',
  'errors:flow-runner-account-mismatch',
  'errors:forbidden',
  'errors:invalid-deploy',
  'errors:invalid-signature-request',
  'errors:invalid-transaction-json-error',
  'errors:key-pair-mismatch',
  'errors:network-error',
  'errors:not-found',
  'errors:server-500-error',
  'errors:server-502-error',
  'errors:server-503-error',
  'errors:server-504-error',
  'errors:server-506-error',
  'errors:server-507-error',
  'errors:server-508-error',
  'errors:server-510-error',
  'errors:server-error',
  'errors:timeout-error',
  'errors:transaction-settlement-timeout',
  'errors:transaction-watch-cancelled',
  'errors:unauthorized',
  'errors:unexpected',
  'errors:unexpected-http',
] as const;

export type CoreErrorMessageKey = (typeof CORE_ERROR_MESSAGE_KEYS)[number];
