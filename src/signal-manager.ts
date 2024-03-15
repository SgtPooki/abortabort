export interface SignalManagerStats {
  managerId: string
  totalChildSignals: number
  childSignalCreators: Record<string, number>
  parentManagers: SignalManagerStats[]
}
export interface SignalManagerOptions {
  signal?: AbortSignal
  enableBidirectionalAbort?: boolean
}

export class AbortError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'AbortError'
  }
}

export class SignalManager implements AbortSignal {
  readonly sharedController: AbortController = new AbortController()
  private readonly userSignal?: AbortSignal
  private readonly childControllers = new Map<AbortController, string>()
  private readonly childSignalCreators = new Map<string, number>()
  readonly parentManagers = new Set<SignalManager>()
  private readonly managerId: string
  private _childSignalCount: number = 0
  // Flag to enable bidirectional abort cascading

  private readonly enableBidirectionalAbort: boolean

  // Implementing AbortSignal interface
  readonly aborted!: boolean
  onabort: ((this: AbortSignal, ev: Event) => any) | null = null

  constructor (managerId: string, options?: SignalManagerOptions) {
    const { signal, enableBidirectionalAbort } = { ...options, enableBidirectionalAbort: false }
    this.managerId = managerId
    this.userSignal = signal
    this.enableBidirectionalAbort = enableBidirectionalAbort

    this.userSignal?.addEventListener('abort', () => {
      this.reason = this.userSignal?.reason ?? `aborted by user signal ${managerId}`
      this.sharedController.abort()
    })

    this.sharedController.signal.addEventListener('abort', this.handleAbortEvent.bind(this))

    Object.defineProperty(this, 'aborted', {
      get: () => this.sharedController.signal.aborted || ((this.userSignal != null) ? this.userSignal.aborted : false)
    })
  }

  private handleAbortEvent (): void {
    // This function handles the abort event and decides whether to propagate the abort based on the flag
    if (this.enableBidirectionalAbort) {
      /**
       * The optional cascading from the child to the parent allows users to choose whether aborting the child should also abort the parent, which is useful in scenarios where a component's failure requires halting all dependent operations.
       * If bidirectional abort is enabled, propagate the abort to parent managers
       */
      this.parentManagers.forEach(parentManager => {
        parentManager.abortAll(`Bidirectional abort triggered by ${this.managerId}`)
      })
    }

    // The unconditional cascading from the parent to the child ensures that aborting the parent always affects the child, which aligns with typical parent-child abort cascading behavior.
    this.childControllers.forEach((_, controller) => {
      controller.abort()
    })

    // Optionally, set the reason for the abort
    this.reason = new AbortError(`Aborted by shared signal ${this.managerId}`)
  }

  reason: AbortSignal['reason'] | undefined = undefined
  throwIfAborted (): void {
    if (this.aborted) {
      throw this.reason
    }
  }

  createChildSignal (creatorId: string = 'unknown'): AbortSignal {
    this._childSignalCount++
    const childController = new AbortController()
    this.childControllers.set(childController, creatorId)

    const count = this.childSignalCreators.get(creatorId) ?? 0
    this.childSignalCreators.set(creatorId, count + 1)

    // Abort the child signal immediately if the shared or user signal is already aborted
    if (this.aborted) {
      childController.abort()
    }

    // No need to add an individual abort listener to the child signal here
    // The global abort listener on the sharedController's signal will take care of aborting this child signal

    return childController.signal
  }

  createParent (parentManagerId: string, enableBidirectionalAbort: boolean = false): SignalManager {
    const parentManager = new SignalManager(parentManagerId, { enableBidirectionalAbort })
    this.parentManagers.add(parentManager)

    return parentManager
  }

  get childSignalCount (): number {
    return this._childSignalCount
  }

  stats (): SignalManagerStats {
    const childCreatorsStats = Array.from(this.childSignalCreators.entries()).reduce<Record<string, number>>((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})

    const parentManagerStats = Array.from(this.parentManagers).map(manager => manager.stats())

    return {
      managerId: this.managerId,
      totalChildSignals: this._childSignalCount,
      childSignalCreators: childCreatorsStats,
      parentManagers: parentManagerStats
    }
  }

  abortAll (reason?: string): void {
    this.reason = reason ?? new AbortError(`abortAll called on shared signal ${this.managerId}`)
    this.sharedController.abort()
    // should we abort all parent managers as well, ensuring a cascading abort effect?
    // this.parentManagers.forEach(manager => { manager.abortAll() })
  }

  /**
   * You should not call this. It is only here to satisfy the AbortSignal interface.
   *
   * @deprecated
   */
  addEventListener (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
    this.sharedController.signal.addEventListener(type, listener, options)
  }

  /**
   * You should not call this. It is only here to satisfy the AbortSignal interface.
   *
   * @deprecated
   */
  removeEventListener (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
    this.sharedController.signal.removeEventListener(type, listener, options)
  }

  /**
   * You should not call this. It is only here to satisfy the AbortSignal interface.
   *
   * @deprecated
   */
  dispatchEvent (event: Event): boolean {
    return this.sharedController.signal.dispatchEvent(event)
  }
}
