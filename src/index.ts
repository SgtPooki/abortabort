import debug from 'debug'

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
}

const defaultOptions: AbortAbortOptions = {
  dependants: [],
  maximumFailedDependants: Infinity
}
/**
 * A class that handles AbortController nesting.
 *
 * Features:
 * * Any dependants of an AbortAbort class are aborted when it is aborted.
 * * An AbortAbort class can see how many of its dependants have been aborted
 * * An attempt to add a dependant to an already aborted AbortAbort class will immediately abort the dependant
 * * An AbortAbort instance will abort if a certain percentage of its dependants have been aborted
 *
 * TODO features:
 *
 */
export default class AbortAbort {
  private readonly _dependants: AbortAbort[] = []
  private readonly abortController: AbortController

  constructor (protected readonly options: AbortAbortOptions = defaultOptions) {
    this.abortController = new AbortController()

    if (this.options?.dependants != null && this.options.dependants.length > 0) {
      this.options.dependants.forEach((dependant) => { this.addDependant(dependant) })
    }
    this.abortAllDependencies = this.abortAllDependencies.bind(this)
    this.updateOnDependantAbort = this.updateOnDependantAbort.bind(this)

    this.signal.addEventListener('abort', this.abortAllDependencies, { once: true })

    if (options?.timeout != null) {
      setTimeout(() => {
        this.abort(new Error(`${this.toString()} timeout of ${options.timeout}ms exceeded`))
      }, options.timeout)
    }
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

  toString (): string {
    return this.options?.id != null ? `AbortAbort(${this.options.id})` : 'AbortAbort'
  }

  /**
   * Abort all dependants of this instance.
   * You can call this method directly in order to keep this instance alive but abort all of its dependants.
   */
  public abortAllDependencies (): void {
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
  public addDependant (dependant: AbortAbort): void {
    if (this.signal.aborted) {
      dependant.abort(new Error(`${dependant.toString()} could not be added as a dependency to an already aborted ${this.toString()} instance`))
      return
    }
    this._dependants.push(dependant)

    dependant.signal.addEventListener('abort', () => {
      trace(`Dependant ${dependant.toString()} aborted`)
      this.updateOnDependantAbort(dependant)
    }, { once: true })
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

  private updateOnDependantAbort (dependant: AbortAbort): void {
    this.checkMaximumFailedDependants()
    this.checkSuccessRatioLimit()
  }

  private checkMaximumFailedDependants (): void {
    const maxFailedDeps = this.options.maximumFailedDependants
    if (maxFailedDeps == null) {
      return
    }
    const failedDependants = this._dependants.length - this.successfulDependants
    if (failedDependants >= maxFailedDeps) {
      this.abort(new Error(`${this.toString()} violated maximumFailedDependants setting: Expected max of '${maxFailedDeps}', received '${failedDependants}'`))
    }
  }

  private checkSuccessRatioLimit (): void {
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
