const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const router = express.Router();
const uploadsRoot = path.join(__dirname, '..', 'uploads', 'attachments');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const allowedMimeTypes = new Set([
  'application/json',
  'application/msword',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'text/csv',
  'text/plain',
]);

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

function isAllowedAttachmentMimeType(mimeType) {
  return mimeType.startsWith('image/') || allowedMimeTypes.has(mimeType);
}

function getAttachmentKind(mimeType) {
  return mimeType.startsWith('image/') ? 'image' : 'file';
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsRoot);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname) || '';
    callback(null, `${req.user.id}-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedAttachmentMimeType(file.mimetype)) {
      callback(new Error('Unsupported file type.'));
      return;
    }

    callback(null, true);
  },
});

function formatUploadAttachment(attachment) {
  return {
    id: attachment.id,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    kind: attachment.kind,
    url: attachment.url,
  };
}

router.post('/attachments', auth, (req, res) => {
  upload.array('files', MAX_FILES)(req, res, async (error) => {
    if (error) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Files must be 10 MB or smaller.'
        : error.code === 'LIMIT_FILE_COUNT'
          ? `You can upload up to ${MAX_FILES} files at once.`
          : error.message;

      return res.status(400).json({ error: message });
    }

    try {
      if (!req.files?.length) {
        return res.status(400).json({ error: 'At least one file is required.' });
      }

      const attachments = await Promise.all(
        req.files.map((file) =>
          prisma.attachment.create({
            data: {
              originalName: file.originalname,
              storedName: file.filename,
              mimeType: file.mimetype,
              size: file.size,
              kind: getAttachmentKind(file.mimetype),
              url: `/uploads/attachments/${file.filename}`,
              uploadedById: req.user.id,
            },
          })
        )
      );

      res.status(201).json({
        attachments: attachments.map(formatUploadAttachment),
      });
    } catch (err) {
      console.error('Upload attachment error:', err);
      res.status(500).json({ error: 'Server error. Please try again.' });
    }
  });
});

module.exports = router;
