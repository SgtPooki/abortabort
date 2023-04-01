
export interface AbortAbortOptions {
  /**
   * The number of milliseconds to wait before triggering the AbortSignal.
   * @see https://nodejs.org/api/globals.html#static-method-abortsignaltimeoutdelay
   */
  timeout?: number;

  /**
   * An array of AbortAbort instances that will be aborted if this instance is aborted.
   */
  dependants?: InstanceType<typeof AbortAbort>[];

  /**
   * A unique identifier for this AbortAbort instance.
   */
  id?: string

  /**
   * The minimum success ratio of dependants that must be successful for this instance to not abort.
   * Upon a dependant's abort, the success ratio is calculated and if it is less than this value, this instance will abort.
   */
  successRatioLimit?: number
}

const defaultOptions: AbortAbortOptions = {
  dependants: []
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
  private readonly _dependants: AbortAbort[] = [];
  private readonly abortController: AbortController;

  constructor(protected readonly options: AbortAbortOptions = defaultOptions) {
    this.abortController = new AbortController();

    if (this.options?.dependants != null && this.options.dependants.length > 0) {
      this.options.dependants.forEach((dependant) => this.addDependant(dependant));
    }

    this.signal.addEventListener('abort', this.abortAllDependencies, { once: true })

    if (options?.timeout != null) {
      setTimeout(() => {
        this.abort(new Error(`${this.toString()} timeout of ${options.timeout}ms exceeded`));
      }, options.timeout);
    }
  }

  abort(reason: unknown = new Error('Unknown AbortAbort reason')): void {
    console.log(`${this.toString()} is aborting`, reason)
    this.abortController.abort(reason);
  }

  get aborted(): boolean {
    return this.signal.aborted;
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  toString(): string {
    return this.options?.id ? `AbortAbort(${this.options.id})` : 'AbortAbort';
  }

  abortAllDependencies() {
    console.log(`${this.toString()} abortAllDependencies`);
    this._dependants.forEach((child: AbortAbort): void => {
      const dependantError = new Error(`${child.toString()} relies on another ${this.toString()} that was aborted`)
      child.abort(dependantError);
    });
  }

  /**
   * @param dependant - An AbortAbort instance that will be aborted if this instance is aborted.
   */
  addDependant(dependant: AbortAbort): void {
    if (this.signal.aborted === true) {
      dependant.abort(new Error(`${dependant.toString()} could not be added as a dependency to an already aborted ${this.toString()} instance`));
      return
    }
    this._dependants.push(dependant);

    dependant.signal.addEventListener('abort', () => {
      this.updateOnDependantAbort(dependant)
    }, { once: true });
  }

  updateOnDependantAbort(dependant: AbortAbort) {
    console.log(`Dependant ${dependant.toString()} aborted`);
    const successRatio = this.calculateSuccessRatio()
    if (this.options.successRatioLimit && successRatio < this.options.successRatioLimit) {
      this.abort(new Error(`${this.toString()} failed due to dependant success ratio of ${successRatio}`))
    }
  }

  calculateSuccessRatio() {
    const successfulDependants = this._dependants.filter((dependant) => dependant.aborted === false).length;
    const totalDependants = this._dependants.length;
    const successRatio = successfulDependants / totalDependants;
    console.log(`Success ratio: ${successRatio} (${successfulDependants} / ${totalDependants})`)
    return successRatio;
  }

}
