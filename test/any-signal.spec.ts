import { expect } from 'aegir/chai'
import pRetry from 'p-retry'
import tsSinon from 'ts-sinon'
import AbortAbort from '../src/index.js'
import type Sinon from 'sinon'
const sinon = tsSinon.default

type AddSpy = Sinon.SinonSpy<[type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions | undefined], void>
type RemoveSpy = Sinon.SinonSpy<[type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions | undefined], void>

async function expectSpyCallCount (spy: sinon.SinonSpy, count: number): Promise<void> {
  await pRetry(() => {
    expect(spy.callCount).to.equal(count)
  }, { retries: 10 })
}

function getSignalsAndSpies (controllers: AbortController[]): { addSpies: AddSpy[], signals: AbortSignal[], removeSpies: RemoveSpy[] } {
  return controllers.reduce((acc, c) => {
    acc.addSpies = acc.addSpies ?? []
    acc.addSpies.push(sinon.spy(c.signal, 'addEventListener'))
    acc.signals = acc.signals ?? []
    acc.signals.push(c.signal)
    acc.removeSpies = acc.removeSpies ?? []
    acc.removeSpies.push(sinon.spy(c.signal, 'removeEventListener'))
    return acc
  }, { addSpies: [] as AddSpy[], signals: [] as AbortSignal[], removeSpies: [] as RemoveSpy[] })
}

// tests taken from https://github.com/jacobheun/any-signal/blob/master/test/index.spec.ts and adapted to AbortAbort
describe('AbortAbort.anySignal', () => {
  it('should abort from any signal', () => {
    const controllers = [...new Array(5)].map(() => new AbortController())
    const aabort = AbortAbort.anySignal(controllers.map((controller) => controller.signal))
    expect(aabort).to.have.property('aborted', false)

    // pick a random controller to abort
    const controller = controllers[Math.floor(Math.random() * controllers.length)]
    controller.abort()

    expect(controller.signal).to.have.property('aborted', true)
    expect(aabort).to.have.property('aborted', true)
    controllers.forEach((c) => {
      if (c !== controller) {
        // other controllers/signals should not be aborted
        expect(c.signal).to.have.property('aborted', false)
      } else {
        expect(c.signal).to.have.property('aborted', true)
      }
    })
  })

  it('should only abort once', async () => {
    const controllers = [...new Array(5)].map(() => new AbortController())
    const signals = controllers.map(c => c.signal)
    // call with undefined value in array
    const aabort = AbortAbort.anySignal([...signals])
    expect(aabort).to.have.property('aborted', false)
    const spy = sinon.spy()
    aabort.addEventListener('abort', spy)

    const randomController = controllers[Math.floor(Math.random() * controllers.length)]
    randomController.abort()
    expect(randomController.signal).to.have.property('aborted', true)

    await expectSpyCallCount(spy, 1)
    expect(aabort).to.have.property('aborted', true)
  })

  it('should ignore non signals', async () => {
    const controllers = [...new Array(5)].map(() => new AbortController())
    const signals = controllers.map(c => c.signal)
    // call with undefined value in array
    const aabort = AbortAbort.anySignal([...signals, null, undefined])
    expect(aabort).to.have.property('aborted', false)
    const spy = sinon.spy()
    aabort.addEventListener('abort', spy)

    const randomController = controllers[Math.floor(Math.random() * controllers.length)]
    randomController.abort()
    expect(randomController.signal).to.have.property('aborted', true)

    await expectSpyCallCount(spy, 1)
    expect(aabort).to.have.property('aborted', true)
  })

  it('should abort if a provided signal is already aborted', () => {
    const controllers = [...new Array(5)].map(() => new AbortController())
    const signals = controllers.map(c => c.signal)
    const randomController = controllers[Math.floor(Math.random() * controllers.length)]
    randomController.abort()

    const aabort = AbortAbort.anySignal(signals, { id: 'anySignal' })
    expect(aabort).to.have.property('aborted', true)
  })

  it('should explicitly clear handlers', () => {
    const controllers = [...new Array(5)].map(() => new AbortController())
    const { addSpies, signals, removeSpies } = getSignalsAndSpies(controllers)
    const aabortDependents = signals.map((s, i) => AbortAbort.fromSignal(s, { id: `signalChild${i}` }))
    const aabort = AbortAbort.anySignal(aabortDependents, { id: 'anySignalRoot' })
    // No aborts
    expect(aabort).to.have.property('aborted', false)

    // Each signal got an "abort" listener
    addSpies.forEach((spy, i) => {
      expect(spy.callCount, `signal at index ${i} has called addEventHandler once`).to.equal(1)
    })

    // (abortAllDependencies + dependentAbortedHandler + AbortControllerFromSignal listener) * dependantCount + 1 root
    expect(aabort.sumTotalListeners).to.equal(aabortDependents.length * 3 + 1)

    // now clear all AbortAbort event handlers. This should remove all AbortAbort owned listeners from all signals
    aabort.clear()
    // No aborts still
    expect(aabort).to.have.property('aborted', false)

    removeSpies.forEach((rSpy, i) => {
      expect(rSpy.callCount, `signal at index ${i} has called removeEventHandler once`).to.equal(1)
    })
    expect(aabort.sumTotalListeners).to.equal(0)
  })

  // it('should abort after clear', () => {})
  it('should abort after clear', () => {
    const controllers = [...new Array(5)].map(() => new AbortController())
    const signals = controllers.map((controller) => controller.signal)
    const aabortDependents = signals.map((s, i) => AbortAbort.fromSignal(s, { id: `signalChild${i}` }))
    const aabort = AbortAbort.anySignal(aabortDependents, { id: 'anySignalRoot' })
    expect(aabort).to.have.property('aborted', false)
    // Clear event handlers
    aabort.clear()

    const randomController = controllers[Math.floor(Math.random() * controllers.length)]
    randomController.abort()

    // No handlers means there are no events propagated to the composite `signal`
    expect(aabort).to.have.property('aborted', false)
  })

  // One of the major benefits of AbortAbort is that you can manage a tree of AbortAborts, AbortControllers, and AbortSignals
  // without needing to deal with increasing maxListeners on an AbortSignal.
  // Basically, instead of creating a nesting level of anySignals that propogate throughout your application,
  // You can create a single AbortAbort that you can add and remove from as needed.
  // This will prevent you from shooting yourself in the foot with eventListener handling, but will
  // increase the memory footprint of your application due to additional space required for the AbortAbort instances.
  // Ideally, the need for complexity of your application code managing AbortSignals should be reduced by using AbortAbort,
  // While giving you the confidence that nested AbortSignals will not cause you to miss an abort event,
  // and will allow you to easily configure complex abort-state management scenarios easily.
  // it('should be able to increase max number of listeners on returned signal', () => {
  //   expect.fail('Purposefully not supported because this is bad')
  // })
})
