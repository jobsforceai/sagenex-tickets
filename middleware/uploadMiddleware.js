import path from 'path';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';

function useS3() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_BUCKET_NAME && process.env.AWS_REGION);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
    cb(null, `${Date.now()}-${safe}`);
  }
});

const s3Storage = () =>
  multerS3({
    s3: new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    }),
    bucket: process.env.AWS_BUCKET_NAME,
    acl: process.env.AWS_S3_ACL || 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
      cb(null, `sagenex-tickets/${Date.now()}-${safe}`);
    }
  });

export const upload = multer({
  storage: useS3() ? s3Storage() : storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  }
});
