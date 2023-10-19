/**
 * Invert the control of an AbortController by creating an AbortController from an AbortSignal.
 *
 * This is useful if you already have an AbortSignal and want to create an AbortController from it,
 * preventing the need to:
 *
 * 1. create an AbortController
 * 2. get it's signal
 * 3. tie the new AbortController.signal and the signal you already have together.
 */
export class AbortControllerFromSignal extends AbortController {
  constructor (private readonly givenSignal: AbortSignal) {
    super()
    if (this.givenSignal.aborted) {
      this.abort()
      return
    }
    this.givenSignal.addEventListener('abort', this.#onGivenSignalAbort, { once: true })
  }

  #onGivenSignalAbort = (): void => {
    this.abort()
  }

  // maybe we need a clear method here to remove the listener from the given signal?
  clear (): void {
    this.givenSignal.removeEventListener('abort', this.#onGivenSignalAbort)
  }

  // addEventListener: AbortSignal['addEventListener'] = (...args: Parameters<AbortSignal['removeEventListener']>) => {
  //   // eslint-disable-next-line no-console
  //   console.log('Adding an event listener to AbortControllerFromSignal', args)

  //   // this._listenerCount++
  //   this.signal.addEventListener(...args)
  // }

  // removeEventListener: AbortSignal['removeEventListener'] = (...args: Parameters<AbortSignal['removeEventListener']>) => {
  //   // eslint-disable-next-line no-console
  //   console.log('Removing an event listener from AbortControllerFromSignal', args)

  //   // this._listenerCount--
  //   this.signal.removeEventListener(...args)
  // }

  // dispatchEvent: AbortSignal['dispatchEvent'] = (...args: Parameters<AbortSignal['dispatchEvent']>): boolean => {
  //   return this.signal.dispatchEvent(...args)
  // }
}
