export const logFrontendError = (context, error) => {
  console.error(`[Frontend] ${context}`, error)
}

export const toGenericErrorMessage = (error, userMessage, context = userMessage) => {
  logFrontendError(context, error)
  return userMessage
}
