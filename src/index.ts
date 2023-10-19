import debug from 'debug'
import { AbortControllerFromSignal } from './AbortControllerFromSignal.js'

const log = debug('abortabort')
const trace = log.extend('trace')

export interface AbortAbortOptions {
  /**
   * The number of milliseconds to wait before triggering the AbortSignal.
   *
   * @see https://nodejs.org/api/globals.html#static-method-abortsignaltimeoutdelay
   */
  timeout?: number

  /**
   * An array of AbortAbort instances that will be aborted if this instance is aborted.
   */
  dependants?: Array<InstanceType<typeof AbortAbort>>

  /**
   * A unique identifier for this AbortAbort instance.
   */
  id?: string

  /**
   * The minimum success ratio of dependants that must be successful for this instance to not abort.
   * Upon a dependant's abort, the success ratio is calculated and if it is less than this value, this instance will abort.
   */
  successRatioLimit?: number

  /**
   * The maximum number of dependants that can fail before this instance aborts.
   */
  maximumFailedDependants?: number

  /**
   * An existing AbortSignal that you want to wrap with AbortAbort
   */
  signal?: AbortSignal
}

const defaultOptions: AbortAbortOptions = {
  dependants: [],
  maximumFailedDependants: Infinity
}

/**
 * A class that handles AbortController & AbortSignal nesting.
 *
 * Features:
 * * Any dependants of an AbortAbort are aborted when it is aborted.
 * * An AbortAbort can see how many of its dependants have been aborted
 * * An attempt to add a dependant to an already aborted AbortAbort will immediately abort the dependant
 * * An AbortAbort can abort if a certain percentage of its dependants have been aborted
 * * An AbortAbort can abort if a certain number of its dependants have been aborted
 * * An AbortAbort can be added to another as a dependant at any time
 *
 * TODO features:
 * * Support calculation of success ratio based on a custom function
 * * Use all nested dependants in calculation of success ratio
 * * Support configuration of successRatioLimit (only direct children? or all?)
 *
 */
export default class AbortAbort extends EventTarget {
  private readonly _dependants: AbortAbort[] = []
  private readonly abortController: AbortController | AbortControllerFromSignal
  public readonly id: symbol
  #_listenerCount = 0

  // TODO: support multiple parents.
  // private readonly _parents: AbortAbort[] = []

  constructor (protected readonly options: AbortAbortOptions = defaultOptions) {
    super()
    if (options.signal != null) {
      this.abortController = new AbortControllerFromSignal(options.signal)
      this.#_listenerCount++ // listener created by AbortControllerFromSignal
    } else {
      this.abortController = new AbortController()
    }
    this.id = Symbol(options.id ?? 'AbortAbort')

    if (this.options?.dependants != null && this.options.dependants.length > 0) {
      this.options.dependants.forEach((dependant) => { this.addDependant(dependant) })
    }
    this.addEventListener('abort', this.abortAllDependencies, { once: true })

    if (options?.timeout != null) {
      AbortSignal.timeout(options.timeout).addEventListener('abort', () => {
        this.abort(new Error(`${this.toString()} timeout of ${options.timeout}ms exceeded`))
      }, { once: true })
    }
  }

  static fromSignal (signal: AbortSignal, options: Partial<AbortAbortOptions> = {}): AbortAbort {
    return new AbortAbort({ ...options, signal })
  }

  /**
   * A replacement for https://www.npmjs.com/package/any-signal that uses AbortAbort instead.
   * This method will set up an AbortAbort with `successRatioLimit` set to 1 so that it will abort if any of the provided signals abort.
   */
  static anySignal (signals: Array<AbortSignal | undefined | null | AbortAbort>, options: Partial<AbortAbortOptions> = {}): AbortAbort {
    const validSignals = signals.filter((signal): signal is (AbortAbort | AbortSignal) => signal != null)
    const aabort = new AbortAbort({ ...options, successRatioLimit: 1 })

    validSignals.forEach((signal) => {
      if (aabort.aborted) {
        return
      }
      if (signal.aborted) {
        aabort.abort()
        return
      }
      if (signal instanceof AbortSignal) {
        aabort.addDependant(AbortAbort.fromSignal(signal)); return
      }

      aabort.addDependant(signal)
    })

    aabort.updateOnDependentChange()
    return aabort
  }

  abort (reason: unknown = new Error('Unknown AbortAbort reason')): void {
    trace(`${this.toString()} is aborting`, reason)
    this.abortController.abort(reason)
  }

  get aborted (): boolean {
    return this.signal.aborted
  }

  get signal (): AbortSignal {
    return this.abortController.signal
  }

  addEventListener: AbortSignal['addEventListener'] = (...args: Parameters<AbortSignal['removeEventListener']>) => {
    this.#_listenerCount++
    this.signal.addEventListener(...args)
  }

  removeEventListener: AbortSignal['removeEventListener'] = (...args: Parameters<AbortSignal['removeEventListener']>) => {
    this.#_listenerCount--
    this.signal.removeEventListener(...args)
  }

  dispatchEvent: AbortSignal['dispatchEvent'] = (...args: Parameters<AbortSignal['dispatchEvent']>): boolean => {
    return this.signal.dispatchEvent(...args)
  }

  get [Symbol.toStringTag] (): string {
    return `AbortAbort(${String(this.id)})`
  }

  toString (): string {
    return `AbortAbort(${String(this.id)})`
  }

  /**
   * Remove any event handlers on this instance, and any handlers on any dependants.
   */
  public clear = (): void => {
    if (this.abortController instanceof AbortControllerFromSignal) {
      this.abortController.clear()
      this.#_listenerCount-- // listener removed by AbortControllerFromSignal
    }
    this.removeEventListener('abort', this.abortAllDependencies)
    this._dependants.forEach((dep: AbortAbort): void => {
      dep.removeEventListener('abort', this.dependentAbortedHandler)
      dep.clear()
    })
  }

  /**
   * Abort all dependants of this instance.
   * You can call this method directly in order to keep this instance alive but abort all of its dependants.
   */
  public abortAllDependencies = (): void => {
    trace(`${this.toString()} abortAllDependencies`)
    this._dependants.forEach((dep: AbortAbort): void => {
      if (dep.aborted) {
        return
      }
      const dependantError = new Error(`${dep.toString()} relies on another ${this.toString()} that was aborted`)
      dep.abort(dependantError)
    })
  }

  /**
   * @param dependant - An AbortAbort instance that will be aborted if this instance is aborted.
   */
  public addDependant = (dependant: AbortAbort): void => {
    if (this.signal.aborted) {
      dependant.abort(new Error(`${dependant.toString()} could not be added as a dependency to an already aborted ${this.toString()} instance`))
      return
    }
    this._dependants.push(dependant)

    // dependant._parents.push(this)
    // dependant.setParent(this)

    dependant.addEventListener('abort', this.dependentAbortedHandler, { once: true })
    // this.updateOnDependentChange() // we've added a new dependent, so we need to update our state
  }

  // private setParent (parent: AbortAbort): void {
  //   this._parents.push(parent)
  // }

  private readonly dependentAbortedHandler = (): void => {
    trace(`Dependant of ${this.toString()} aborted`)
    this.updateOnDependentChange()
  }

  public addParent = (parent: AbortAbort): void => {
    parent.addDependant(this)
    if (this.signal.aborted) {
      parent.updateOnDependentChange()
    }
  }

  get sumTotalListeners (): number {
    return this._dependants.reduce((total, dep) => total + dep.listenerCount, this.#_listenerCount)
  }

  // TODO: remove this and #_listenerCount increments and decrements
  get listenerCount (): number {
    return this.#_listenerCount
  }

  get dependants (): readonly AbortAbort[] {
    return this._dependants
  }

  get successfulDependants (): number {
    return this._dependants.filter((dependant) => !dependant.aborted).length
  }

  public calculateSuccessRatio (): number {
    const successfulDependants = this.successfulDependants
    const totalDependants = this._dependants.length
    const successRatio = successfulDependants / totalDependants
    trace(`Success ratio: ${successRatio} (${successfulDependants} / ${totalDependants})`)
    return successRatio
  }

  /**
   * When a dependants of this instance change, this method is called to update the state of this parent instance.
   */
  private readonly updateOnDependentChange = (): void => {
    this.checkMaximumFailedDependants()
    this.checkSuccessRatioLimit()
  }

  private readonly checkMaximumFailedDependants = (): void => {
    const maxFailedDeps = this.options.maximumFailedDependants
    if (maxFailedDeps == null) {
      return
    }
    const failedDependants = this._dependants.length - this.successfulDependants
    if (failedDependants >= maxFailedDeps) {
      this.abort(new Error(`${this.toString()} violated maximumFailedDependants setting: Expected max of '${maxFailedDeps}', received '${failedDependants}'`))
    }
  }

  private readonly checkSuccessRatioLimit = (): void => {
    const successRatioLimit = this.options.successRatioLimit
    if (successRatioLimit == null) {
      return
    }
    const successRatio = this.calculateSuccessRatio()
    if (successRatio < successRatioLimit) {
      this.abort(new Error(`${this.toString()} violated successRatioLimit. Expected at least '${successRatioLimit}'; received '${successRatio}'`))
    }
  }
}
