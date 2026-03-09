import { AwsClient } from 'aws4fetch'

const requiredEnv = (name) => {
  const value = import.meta.env[name]
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value.trim()
}

const resolveRegion = (urlString) => {
  const configuredRegion = import.meta.env.VITE_AWS_REGION
  if (configuredRegion && configuredRegion.trim()) {
    return configuredRegion.trim()
  }

  const host = new URL(urlString).hostname
  const match = host.match(/lambda-url\.([a-z0-9-]+)\.on\.aws$/)
  if (match?.[1]) {
    return match[1]
  }

  return 'us-east-1'
}

const apiUrl = requiredEnv('VITE_BACKEND_URL')
const awsClient = new AwsClient({
  accessKeyId: requiredEnv('VITE_AWS_ACCESS_KEY_ID'),
  secretAccessKey: requiredEnv('VITE_AWS_SECRET_ACCESS_KEY'),
  service: 'lambda',
  region: resolveRegion(apiUrl),
})

export const invokeLambda = async (action, payload) => {
  const response = await awsClient.fetch(apiUrl, {
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
