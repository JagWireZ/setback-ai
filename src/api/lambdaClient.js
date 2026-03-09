const FALLBACK_URL = '/api'

const resolveApiUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL
  return configuredUrl && configuredUrl.trim() ? configuredUrl.trim() : FALLBACK_URL
}

export const invokeLambda = async (action, payload) => {
  const response = await fetch(resolveApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, payload }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Request failed'
    throw new Error(message)
  }

  return data
}

export const createGame = ({ playerName, maxCards }) =>
  invokeLambda('createGame', {
    playerName,
    maxCards,
  })

export const joinGame = ({ gameId, playerName }) =>
  invokeLambda('joinGame', {
    gameId,
    playerName,
  })
