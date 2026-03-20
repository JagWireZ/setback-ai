export const isStagingBuild = import.meta.env.VITE_APP_ENV === 'staging'

export const buildTimestampLabel =
  typeof __BUILD_TIMESTAMP__ === 'string' ? __BUILD_TIMESTAMP__ : ''
