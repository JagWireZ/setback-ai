import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const [bucket, distDirArg] = process.argv.slice(2)
if (!bucket || !distDirArg) {
  console.error('Usage: node infrastructure/scripts/syncFrontendToS3.mjs <bucket> <distDir>')
  process.exit(1)
}

const distDir = path.resolve(process.cwd(), distDirArg)
const s3 = new S3Client({})

const contentTypes = new Map([
  ['.html', 'text/html'],
  ['.css', 'text/css'],
  ['.js', 'application/javascript'],
  ['.json', 'application/json'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain'],
  ['.map', 'application/json'],
  ['.webp', 'image/webp'],
])

const walkFiles = async (rootDir) => {
  const results = []
  const stack = ['']

  while (stack.length > 0) {
    const relativeDir = stack.pop()
    const absoluteDir = path.join(rootDir, relativeDir)
    const entries = await readdir(absoluteDir, { withFileTypes: true })

    for (const entry of entries) {
      const relativePath = path.posix.join(relativeDir, entry.name)
      if (entry.isDirectory()) {
        stack.push(relativePath)
      } else if (entry.isFile()) {
        results.push(relativePath)
      }
    }
  }

  return results
}

const localFiles = await walkFiles(distDir)
const localKeys = new Set(localFiles)

for (const key of localFiles) {
  const absolutePath = path.join(distDir, key)
  const body = await readFile(absolutePath)
  const extension = path.extname(key).toLowerCase()
  const contentType = contentTypes.get(extension) ?? 'application/octet-stream'

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

let continuationToken = undefined
do {
  const response = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
    }),
  )

  for (const object of response.Contents ?? []) {
    const key = object.Key
    if (key && !localKeys.has(key)) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      )
    }
  }

  continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
} while (continuationToken)
