import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePublicKey } from './cloud';
const jwt = (role: string) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
test('only public Supabase keys are accepted; privileged keys fail closed', () => {
  assert.doesNotThrow(() => validatePublicKey('sb_publishable_example'));
  assert.doesNotThrow(() => validatePublicKey(jwt('anon')));
  for (const key of [null, '', 'sb_secret_example', jwt('service_role'), jwt('authenticated'), 'invalid']) {
    assert.throws(() => validatePublicKey(key));
  }
});
