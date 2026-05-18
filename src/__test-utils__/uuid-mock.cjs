/* global Buffer, module */
/**
 * CJS stub for the `uuid` package.
 *
 * uuid v14+ ships pure ESM (no CJS entry) which Jest can't load when running tests
 * in CommonJS mode. The production code only uses `v4`, so we provide a deterministic
 * stub here. Tests that need uniqueness can spy on this module.
 */
let counter = 0;

const pad = n => String(n).padStart(12, '0');

const v4 = () => `00000000-0000-0000-0000-${pad(++counter)}`;
const v1 = () => v4();
const v3 = () => v4();
const v5 = () => v4();
const v6 = () => v4();
const v7 = () => v4();
const NIL = '00000000-0000-0000-0000-000000000000';
const validate = s => /^[0-9a-f-]{36}$/i.test(String(s));
const version = () => 4;
const stringify = bytes => Buffer.from(bytes).toString('hex');
const parse = s => Buffer.from(String(s).replace(/-/g, ''), 'hex');

module.exports = { v1, v3, v4, v5, v6, v7, NIL, validate, version, stringify, parse };
module.exports.default = module.exports;
