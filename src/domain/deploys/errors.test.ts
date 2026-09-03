import { DeploysError, InvalidDeployError, isDeploysError } from './errors';

describe('DeploysError', () => {
  it('keeps name, type, message, stack and the source error', () => {
    const inner = new Error('rpc exploded');
    const err = new DeploysError(inner, 'invalidDeploy');

    expect(err.name).toBe('DeploysRepositoryError');
    expect(err.type).toBe('invalidDeploy');
    expect(err.message).toBe('rpc exploded');
    expect(err.stack).toBe(inner.stack);
    expect(err.sourceError).toBe(inner);
    expect(isDeploysError(err)).toBe(true);
  });

  it('keeps InvalidDeployError message keys', () => {
    expect(new InvalidDeployError().message).toBe('errors:invalid-deploy');
    expect(new InvalidDeployError('errors:deploy-rpc-error').message).toBe(
      'errors:deploy-rpc-error',
    );
    expect(new InvalidDeployError().type).toBe('invalidDeploy');
  });
});
