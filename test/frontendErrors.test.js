import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'

import { logFrontendError, toGenericErrorMessage } from '../src/utils/frontendErrors.js'

test('logFrontendError writes a namespaced console.error entry', () => {
  const errorSpy = mock.method(console, 'error', () => {})
  const error = new Error('boom')

  try {
    logFrontendError('loading game', error)
    assert.equal(errorSpy.mock.calls.length, 1)
    assert.deepEqual(errorSpy.mock.calls[0].arguments, ['[Frontend] loading game', error])
  } finally {
    errorSpy.mock.restore()
  }
})

test('toGenericErrorMessage logs with the context and returns the user-facing message', () => {
  const errorSpy = mock.method(console, 'error', () => {})
  const error = new Error('DynamoDB exploded')

  try {
    const result = toGenericErrorMessage(error, 'Something went wrong. Please try again.', 'submitBid')

    assert.equal(result, 'Something went wrong. Please try again.')
    assert.equal(errorSpy.mock.calls.length, 1)
    assert.deepEqual(errorSpy.mock.calls[0].arguments, ['[Frontend] submitBid', error])
  } finally {
    errorSpy.mock.restore()
  }
})

test('toGenericErrorMessage defaults the log context to the user message', () => {
  const errorSpy = mock.method(console, 'error', () => {})
  const error = new Error('oops')

  try {
    toGenericErrorMessage(error, 'Please try again.')
    assert.deepEqual(errorSpy.mock.calls[0].arguments, ['[Frontend] Please try again.', error])
  } finally {
    errorSpy.mock.restore()
  }
})
