import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront'
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const distDir = path.join(projectRoot, 'dist')

const bucket = process.env.FRONTEND_BUCKET
const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID
const region = process.env.AWS_REGION || 'us-east-1'

if (!bucket) {
  throw new Error('Missing FRONTEND_BUCKET')
}

if (!distributionId) {
  throw new Error('Missing CLOUDFRONT_DISTRIBUTION_ID')
}

const s3 = new S3Client({ region })
const cloudFront = new CloudFrontClient({ region })

const contentTypes = new Map([
  ['.css', 'text/css'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'application/javascript'],
  ['.json', 'application/json'],
  ['.map', 'application/json'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain'],
  ['.webp', 'image/webp'],
])

const collectFiles = async (dir, prefix = '') => {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.posix.join(prefix, entry.name)
      const absolutePath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        return collectFiles(absolutePath, relativePath)
      }

      return [{
        absolutePath,
        relativePath,
      }]
    }),
  )

  return files.flat()
}

const listAllObjects = async () => {
  const objects = []
  let continuationToken

  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
    }))

    for (const object of response.Contents ?? []) {
      if (object.Key) {
        objects.push(object.Key)
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)

  return objects
}

const uploadFiles = async (files) => {
  for (const file of files) {
    const body = await readFile(file.absolutePath)
    const extension = path.extname(file.relativePath).toLowerCase()
    const contentType = contentTypes.get(extension) || 'application/octet-stream'
    const cacheControl = file.relativePath === 'index.html'
      ? 'no-cache'
      : undefined

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: file.relativePath,
      Body: body,
      ContentType: contentType,
      ...(cacheControl ? { CacheControl: cacheControl } : {}),
    }))
  }
}

const deleteRemovedObjects = async (desiredKeys) => {
  const existingKeys = await listAllObjects()
  const keysToDelete = existingKeys.filter((key) => !desiredKeys.has(key))

  for (let index = 0; index < keysToDelete.length; index += 1000) {
    const chunk = keysToDelete.slice(index, index + 1000)
    if (chunk.length === 0) {
      continue
    }

    await s3.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: chunk.map((key) => ({ Key: key })),
      },
    }))
  }
}

const invalidateCloudFront = async () => {
  await cloudFront.send(new CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: `setback-${Date.now()}`,
      Paths: {
        Quantity: 1,
        Items: ['/*'],
      },
    },
  }))
}

const main = async () => {
  const files = await collectFiles(distDir)
  const desiredKeys = new Set(files.map((file) => file.relativePath))

  await uploadFiles(files)
  await deleteRemovedObjects(desiredKeys)
  await invalidateCloudFront()
}

await main()
