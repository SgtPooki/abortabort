import AbortAbort from '../src/index.js';
import { expect } from 'aegir/chai'

describe('AbortAbort', () => {
  it('should abort all dependants', () => {
    const abort1 = new AbortAbort({ id: 'abort1' });
    const abort2 = new AbortAbort({ id: 'abort2' });
    const abort3 = new AbortAbort({ dependants: [abort1, abort2]});
    // abort.addDependant(abort2);
    // abort.addDependant(abort3);
    // abort.abort();
    abort3.abort('Testing abort of all dependants');
    expect(abort1.aborted).to.equal(true);
    expect(abort2.aborted).to.equal(true);
    expect(abort3.aborted).to.equal(true);
  })

  it('should abort if a certain timeout is reached', (done) => {
    const abort = new AbortAbort({ timeout: 100 });
    setTimeout(() => {
      expect(abort.aborted).to.equal(true);
      done();
    }, 150);
  })
})
