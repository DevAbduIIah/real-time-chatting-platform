const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const router = express.Router();
const uploadsRoot = path.join(__dirname, '..', 'uploads', 'attachments');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  'application/msword',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-zip-compressed',
  'application/zip',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
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
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('This file type is not supported.'));
      return;
    }

    callback(null, true);
  },
});

router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'A file is required.' });
    }

    const attachment = await prisma.attachment.create({
      data: {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        kind: req.file.mimetype.startsWith('image/') ? 'image' : 'file',
        url: `/uploads/attachments/${req.file.filename}`,
        uploadedById: req.user.id,
      },
    });

    res.status(201).json({ attachment });
  } catch (err) {
    console.error('Upload attachment error:', err);
    res.status(500).json({ error: err.message || 'Server error. Please try again.' });
  }
});

router.use((err, _req, res, next) => {
  if (!err) {
    next();
    return;
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Files must be 10 MB or smaller.'
      : 'Upload failed.';
    res.status(400).json({ error: message });
    return;
  }

  res.status(400).json({ error: err.message || 'Upload failed.' });
});

module.exports = router;
