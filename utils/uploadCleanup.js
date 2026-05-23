import fs from 'fs/promises';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import logger from './logger.js';

let s3Client;

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        : undefined
    });
  }
  return s3Client;
}

function collectUploadedFiles(req) {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  if (req.files && !Array.isArray(req.files)) {
    Object.values(req.files).forEach((value) => {
      if (Array.isArray(value)) files.push(...value);
      else if (value) files.push(value);
    });
  }
  return files;
}

export async function cleanupUploadedFiles(req) {
  const files = collectUploadedFiles(req);
  await Promise.allSettled(
    files.map(async (file) => {
      if (file?.location && file.key && process.env.AWS_BUCKET_NAME) {
        try {
          await getS3Client().send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: file.key }));
        } catch (error) {
          logger.warn(`Failed to remove S3 upload ${file.key}: ${error.message}`);
        }
        return;
      }
      if (!file?.path) return;
      try {
        await fs.unlink(file.path);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.warn(`Failed to remove uploaded file ${file.path}: ${error.message}`);
        }
      }
    })
  );
}
