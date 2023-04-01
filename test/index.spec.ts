import AbortAbort from '../src/index.js'
import { expect } from 'aegir/chai'

describe('AbortAbort', () => {
  it('should abort all dependants', () => {
    const abort1 = new AbortAbort({ id: 'abort1' })
    const abort2 = new AbortAbort({ id: 'abort2' })
    const abort3 = new AbortAbort({ id: 'abort3', dependants: [abort1, abort2] })

    abort3.abort('Testing abort of all dependants')
    expect(abort1).to.have.property('aborted', true)
    expect(abort2).to.have.property('aborted', true)
    expect(abort3).to.have.property('aborted', true)
  })

  it('should abort if a certain timeout is reached', (done) => {
    const abort = new AbortAbort({ timeout: 100 })
    setTimeout(() => {
      expect(abort).to.have.property('aborted', true)
      done()
    }, 150)
  })

  it('calculateSuccessRatio returns an accurate count', () => {
    const abort1 = new AbortAbort({ id: 'abort1' })
    const abort2 = new AbortAbort({ id: 'abort2' })
    const abort3 = new AbortAbort({ id: 'abort3' })
    const abort4 = new AbortAbort({ id: 'abort4', dependants: [abort1, abort2, abort3] })
    abort1.abort('Testing successRatio')
    expect(abort4.calculateSuccessRatio()).to.be.closeTo(0.66, 0.01)
    abort4.abort()
  })

  it('should abort if dependant successRatioLimit is violated', () => {
    const abort1 = new AbortAbort({ id: 'abort1' })
    const abort2 = new AbortAbort({ id: 'abort2' })
    const abort3 = new AbortAbort({ id: 'abort3', dependants: [abort1, abort2], successRatioLimit: 0.51 })
    abort1.abort('Testing successRatioLimit of 50%')
    expect(abort3).to.have.property('aborted', true)
  })

  it('should abort if dependant maximumFailedDependants is violated', () => {
    const abort1 = new AbortAbort({ id: 'abort1' })
    const abort2 = new AbortAbort({ id: 'abort2' })
    const abort3 = new AbortAbort({ id: 'abort3', dependants: [abort1, abort2], maximumFailedDependants: 1 })
    abort1.abort('Testing maximumFailedDependants of 1')
    expect(abort3).to.have.property('aborted', true)
  })

  it('should support at least 10 levels of nested dependants', () => {
    const abort1 = new AbortAbort({ id: 'abort1' })
    const abort2 = new AbortAbort({ id: 'abort2', dependants: [abort1] })
    const abort3 = new AbortAbort({ id: 'abort3', dependants: [abort2] })
    const abort4 = new AbortAbort({ id: 'abort4', dependants: [abort3] })
    const abort5 = new AbortAbort({ id: 'abort5', dependants: [abort4] })
    const abort6 = new AbortAbort({ id: 'abort6', dependants: [abort5] })
    const abort7 = new AbortAbort({ id: 'abort7', dependants: [abort6] })
    const abort8 = new AbortAbort({ id: 'abort8', dependants: [abort7] })
    const abort9 = new AbortAbort({ id: 'abort9', dependants: [abort8] })
    const abort10 = new AbortAbort({ id: 'abort10', dependants: [abort9] })
    const abort11 = new AbortAbort({ id: 'abort11', dependants: [abort10] })
    abort11.abort('Testing the abort of a significantly nested dependant')

    expect(abort1).to.have.property('aborted', true)
    expect(abort2).to.have.property('aborted', true)
    expect(abort3).to.have.property('aborted', true)
    expect(abort4).to.have.property('aborted', true)
    expect(abort5).to.have.property('aborted', true)
    expect(abort6).to.have.property('aborted', true)
    expect(abort7).to.have.property('aborted', true)
    expect(abort8).to.have.property('aborted', true)
    expect(abort9).to.have.property('aborted', true)
    expect(abort10).to.have.property('aborted', true)
    expect(abort11).to.have.property('aborted', true)
  })
})
