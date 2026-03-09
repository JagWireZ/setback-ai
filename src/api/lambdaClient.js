import { Sha256 } from '@aws-crypto/sha256-js'
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity'
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity'
import { HttpRequest } from '@aws-sdk/protocol-http'
import { SignatureV4 } from '@aws-sdk/signature-v4'

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
const region = resolveRegion(apiUrl)
const identityPoolId = requiredEnv('VITE_COGNITO_IDENTITY_POOL_ID')
if (identityPoolId === 'replace-with-terraform-output' || identityPoolId.includes('xxxxxxxx')) {
  throw new Error('Invalid VITE_COGNITO_IDENTITY_POOL_ID. Set it from Terraform output.')
}

const cognitoClient = new CognitoIdentityClient({ region })
const credentialsProvider = fromCognitoIdentityPool({
  client: cognitoClient,
  identityPoolId,
})
const signer = new SignatureV4({
  service: 'lambda',
  region,
  credentials: credentialsProvider,
  sha256: Sha256,
})

export const invokeLambda = async (action, payload) => {
  const body = JSON.stringify({ action, payload })
  const url = new URL(apiUrl)

  const request = new HttpRequest({
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    method: 'POST',
    path: `${url.pathname}${url.search}`,
    headers: {
      host: url.host,
      'content-type': 'application/json',
    },
    body,
  })

  const signedRequest = await signer.sign(request)
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: signedRequest.headers,
    body,
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
