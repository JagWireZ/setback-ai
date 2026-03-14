export const MAX_PLAYER_NAME_LENGTH = 30

const PLAYER_NAME_ALLOWED_PATTERN = /^[\p{L}\p{N} _().'-]+$/u
const PLAYER_NAME_SANITIZE_PATTERN = /[^\p{L}\p{N} _().'-]+/gu
const PLAYER_NAME_VALIDATION_MESSAGE =
  "Player Name can use letters, numbers, spaces, hyphens, underscores, parentheses, apostrophes, and periods only."

export const sanitizePlayerNameInput = (value) =>
  value.replace(PLAYER_NAME_SANITIZE_PATTERN, '').slice(0, MAX_PLAYER_NAME_LENGTH)

export const validatePlayerName = (value) => {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return 'Player Name is required.'
  }

  if (trimmedValue.length > MAX_PLAYER_NAME_LENGTH) {
    return `Player Name must be ${MAX_PLAYER_NAME_LENGTH} characters or fewer.`
  }

  if (!PLAYER_NAME_ALLOWED_PATTERN.test(trimmedValue)) {
    return PLAYER_NAME_VALIDATION_MESSAGE
  }

  return ''
}

export const truncateLabel = (value, maxLength) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}
