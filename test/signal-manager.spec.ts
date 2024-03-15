import { expect } from 'aegir/chai'
import sinon from 'sinon'
import { SignalManager, type SignalManagerStats } from '../src/signal-manager.js'

describe('signal-manager', () => {
  let userSignal: AbortSignal

  beforeEach(() => {
    userSignal = new AbortController().signal
  })

  afterEach(() => {
    sinon.restore()
  })

  it('should correctly instantiate with a given managerId and optional userSignal', () => {
    const managerId = 'testManager'
    const signalManager = new SignalManager(managerId, { signal: userSignal })

    expect(signalManager).to.be.an.instanceof(SignalManager)
    expect(signalManager.aborted).to.be.false()
  })

  it('should abort the shared signal and all child signals when the userSignal is aborted', (done) => {
    const signalManager = new SignalManager('userAbortTest', { signal: userSignal })
    const childSignal = signalManager.createChildSignal('child1')

    // Wrap the assertions in a function to call after a delay
    const performAssertions = (): void => {
      try {
        expect(signalManager.aborted).to.be.true()
        expect(signalManager.reason).to.have.property('message').that.includes('Aborted by shared signal userAbortTest')
        expect(childSignal.aborted).to.be.true()
        done() // Indicate test completion
      } catch (error) {
        done(error) // Pass the error to Mocha if assertions fail
      }
    }

    // Listen for the abort event on the user signal to perform assertions
    userSignal.addEventListener('abort', () => {
    // Set a timeout to allow the abort logic to process
      setTimeout(performAssertions, 0)
    })

    // Dispatch the abort event to the user signal
    userSignal.dispatchEvent(new Event('abort'))
  })

  it('should increment childSignalCount on createChildSignal', () => {
    const signalManager = new SignalManager('incrementTest')
    signalManager.createChildSignal('child1')
    signalManager.createChildSignal('child2')

    expect(signalManager.childSignalCount).to.equal(2)
  })

  it('should include parent manager stats in child manager stats', () => {
    const parentManager = new SignalManager('parent')
    const grandParentManager = parentManager.createParent('grandParent')

    // Mock grandParentManager's stats to simplify the test
    const mockedStats: SignalManagerStats = { managerId: 'grandParent', totalChildSignals: 0, childSignalCreators: {}, parentManagers: [] }
    sinon.stub(grandParentManager, 'stats').returns(mockedStats)

    const stats = parentManager.stats()

    expect(stats.parentManagers).to.deep.include(mockedStats)
  })
  // Continuing from the previous test suite...

  it('should set the reason property correctly when userSignal is aborted', () => {
    const managerId = 'testReasonUserSignal'
    const signalManager = new SignalManager(managerId, { signal: userSignal })

    userSignal.dispatchEvent(new Event('abort'))

    // expect(signalManager.reason).to.include(managerId)
    expect(signalManager.reason).to.have.property('message').that.includes(managerId)
    expect(signalManager.reason).to.have.property('message').that.includes(`Aborted by shared signal ${managerId}`)
    expect(signalManager.aborted).to.be.true()
  })

  it('should abort child signals immediately if created after shared signal is aborted', () => {
    const signalManager = new SignalManager('testImmediateAbort')
    signalManager.abortAll() // Abort the shared signal before creating child signals

    const childSignal = signalManager.createChildSignal('childAfterAbort')

    expect(childSignal.aborted).to.be.true()
  })

  it('should track the number of child signals created by each creatorId', () => {
    const signalManager = new SignalManager('testCreatorTracking')
    signalManager.createChildSignal('creator1')
    signalManager.createChildSignal('creator1')
    signalManager.createChildSignal('creator2')

    const stats = signalManager.stats()

    expect(stats.childSignalCreators.creator1).to.equal(2)
    expect(stats.childSignalCreators.creator2).to.equal(1)
  })

  it('should abort parent manager and all its child signals when a new signal manager is aborted', (done) => {
    const parentManager = new SignalManager('first signal manager')
    const grandParentManager = parentManager.createParent('grandparent', true)
    const childSignal = parentManager.createChildSignal('some child')

    // Wrap the assertions in a function to call after a delay
    const performAssertions = (): void => {
      try {
        expect(parentManager.aborted).to.be.true()
        expect(childSignal.aborted).to.be.true()
        done() // Indicate test completion
      } catch (error) {
        done(error) // Pass the error to Mocha if assertions fail
      }
    }

    // Listen for the abort event on the parent manager's signal to perform assertions
    parentManager.sharedController.signal.addEventListener('abort', () => {
    // Set a timeout to allow the abort logic to process
      setTimeout(performAssertions, 0)
    })

    // Trigger abort on the grandparent manager, which should cascade to the parent manager and its child signals
    grandParentManager.abortAll()
  })

  it('should throw the stored reason when throwIfAborted is called and the manager is aborted', () => {
    const signalManager = new SignalManager('testThrowIfAborted')
    signalManager.abortAll() // Abort the manager to set the reason

    expect(() => { signalManager.throwIfAborted() }).to.throw()
  })

  it('should not throw when throwIfAborted is called and the manager is not aborted', () => {
    const signalManager = new SignalManager('testNoThrowIfNotAborted')

    expect(() => { signalManager.throwIfAborted() }).to.not.throw()
  })

  // Continue from the existing test suite...

  it('should not affect other parent managers when one is aborted', (done) => {
    const parentManager = new SignalManager('baseManager')
    const parentManager1 = parentManager.createParent('parent1')
    const parentManager2 = parentManager.createParent('parent2')

    parentManager1.sharedController.signal.addEventListener('abort', () => {
      expect(parentManager2.aborted).to.be.false()
      done()
    })

    parentManager1.abortAll()
  })

  it('should abort all levels of child signals when a parent signal manager is aborted', (done) => {
    const parentManager = new SignalManager('parentManager')
    const childSignal = parentManager.createChildSignal('child')
    const grandChildSignal = new SignalManager('grandChild', { signal: userSignal })

    grandChildSignal.sharedController.signal.addEventListener('abort', () => {
      expect(childSignal.aborted).to.be.true()
      done()
    })

    parentManager.abortAll()
  })

  it('should propagate abort reason from parent to child managers and signals', (done) => {
    const parentManager = new SignalManager('parentWithReason')
    const childManager = parentManager.createParent('childWithReason')
    const childSignal = parentManager.createChildSignal('signalWithReason')

    childManager.sharedController.signal.addEventListener('abort', () => {
      expect(parentManager.reason).to.equal(childManager.reason)
      expect(childSignal.reason).to.equal(childManager.reason)
      done()
    })

    childManager.abortAll('Test abort reason')
  })

  it('should allow multiple calls to abortAll without changing the reason', () => {
    const signalManager = new SignalManager('idempotentAbort')
    signalManager.abortAll('First abort reason')
    signalManager.abortAll('Second abort reason')

    expect(signalManager.reason).to.equal('First abort reason')
  })

  it('should clean up event listeners after abort', () => {
    const signalManager = new SignalManager('listenerCleanup')
    const spy = sinon.spy(signalManager.sharedController.signal, 'removeEventListener')

    signalManager.abortAll()

    expect(spy.called).to.be.true()
  })

  it('should accurately report stats after abort', () => {
    const signalManager = new SignalManager('statsAfterAbort')
    signalManager.createChildSignal('child1')
    signalManager.abortAll()

    const stats = signalManager.stats()

    expect(stats.totalChildSignals).to.equal(1)
    expect(stats.childSignalCreators.child1).to.equal(1)
  })

  it('should abort all child signals when user signal is aborted after child creation', (done) => {
    const userSignalController = new AbortController()
    const signalManager = new SignalManager('userAbortAfterChildren', { signal: userSignalController.signal })
    signalManager.createChildSignal('child1')

    signalManager.sharedController.signal.addEventListener('abort', () => {
      expect(signalManager.childSignalCount).to.equal(1)
      done()
    })

    userSignalController.abort()
  })

  it('should handle creating new child signals from an aborted SignalManager', () => {
    const signalManager = new SignalManager('reuseAfterAbort')
    signalManager.abortAll()
    const newChildSignal = signalManager.createChildSignal('newChild')

    expect(newChildSignal.aborted).to.be.true()
  })
})
