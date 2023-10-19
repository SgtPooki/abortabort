import { expect } from 'aegir/chai'
import tsSinon from 'ts-sinon'
import AbortAbort from '../src/index.js'

const sinon = tsSinon.default

describe('AbortAbort events', () => {
  it('should be able to add an event listener', () => {
    const aabort = new AbortAbort()

    const s = sinon.spy()
    aabort.addEventListener('abort', s)
    expect(s.callCount).to.equal(0)
    aabort.abort()
    expect(s.callCount).to.equal(1)
  })
  it('should be able to remove an event listener', () => {
    const aabort = new AbortAbort()

    const s = sinon.spy()
    aabort.addEventListener('abort', s)
    expect(s.callCount).to.equal(0)
    aabort.removeEventListener('abort', s)
    aabort.abort()
    expect(s.callCount).to.equal(0)
  })
  it('should be able to dispatch an event', () => {
    const aabort = new AbortAbort()

    const s = sinon.spy()
    aabort.addEventListener('abort', s)
    expect(s.callCount).to.equal(0)
    aabort.dispatchEvent(new Event('abort'))
    expect(s.callCount).to.equal(1)
  })
})
