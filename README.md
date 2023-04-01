# abortabort <!-- omit in toc -->

[![codecov](https://img.shields.io/codecov/c/github/SgtPooki/abortabort.svg?style=flat-square)](https://codecov.io/gh/SgtPooki/abortabort)
[![CI](https://img.shields.io/github/actions/workflow/status/SgtPooki/abortabort/js-test-and-release.yml?branch=main\&style=flat-square)](https://github.com/SgtPooki/abortabort/actions/workflows/js-test-and-release.yml?query=branch%3Amain)

> Simple AbortController wrapper that makes it easy to nest signals

## Table of contents <!-- omit in toc -->

- [Features](#features)
- [Install](#install)
- [Usage](#usage)
- [License](#license)
- [Contribution](#contribution)

## Features

* Any dependants of an AbortAbort are aborted when it is aborted.
* An AbortAbort can see how many of its dependants have been aborted
* An attempt to add a dependant to an already aborted AbortAbort will immediately abort the dependant
* An AbortAbort can abort if a certain percentage of its dependants have been aborted
* An AbortAbort can abort if a certain number of its dependants have been aborted
* An AbortAbort can be added to another as a dependant at any time

## Install

```console
$ npm i abortabort
```

## Usage

See [the tests](./test/index.spec.ts) for more usage examples than what is below.

### option: successRatioLimit

A few things of note:

* The success ratio is returned without any limiting on the precision. It is up to you to do so.
* The comparison is done with `actualSuccessRatio < successRatioLimit`, so if you have two dependants, and you set the
  value to `0.5`, it will not abort. If you want to set it to abort, you should set it to `0.51`

```js
import AbortAbort from 'abortabort'

const abortChild1 = new AbortAbort({ id: 'abortChild1' })
const abortChild2 = new AbortAbort({ id: 'abortChild2' })

/**
 * abortExample1 will abort on the first of any of these events:
 * * 15 seconds passes
 * * abortChild1 aborts (successRatio will be 0.50)
 */
const abortExample1 = new AbortAbort({ id: 'abortExample1', dependants: [abortChild1, abortChild2], timeout: 15000, successRatioLimit: 0.51 })

```

### option: maximumFailedDependants
Set this to 0 to fail an AbortAbort anytime one of it's children aborts.

```js

import AbortAbort from 'abortabort'
const abortChild1 = new AbortAbort({ id: 'abortChild1' })
const abortChild2 = new AbortAbort({ id: 'abortChild2' })
const abortChild3 = new AbortAbort({ id: 'abortChild3', dependants: [abortChild1], maximumFailedDependants: 0})

/**
 * abortExample1 will abort on the first of any of these events:
 * * 15 seconds passes
 * * abortChild3 aborts (maximumFailedDependants >= 0)
 * * abortChild1 aborts (it will cause abortChild3 to abort)
 */
const abortExample2 = new AbortAbort({ id: 'abortExample2', dependants: [abortChild1, abortChild2], maximumFailedDependants: 0 })

```

## License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

## Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.
