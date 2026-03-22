const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { publicUserSelect } = require('./user-helpers');

const router = express.Router();
const uploadsRoot = path.join(__dirname, '..', 'uploads', 'avatars');

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsRoot);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname) || '.png';
    callback(null, `${req.user.id}-${Date.now()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('Only image uploads are allowed.'));
      return;
    }

    callback(null, true);
  },
});

function getStoredAvatarPath(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith('/uploads/avatars/')) {
    return null;
  }

  return path.join(uploadsRoot, path.basename(avatarUrl));
}

// Get all users except the current user
router.get('/', auth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
      },
      select: publicUserSelect,
      orderBy: { name: 'asc' },
    });

    res.json({ users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

router.patch('/me', auth, async (req, res) => {
  try {
    const { name, email, bio, statusText } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        id: { not: req.user.id },
      },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name.trim(),
        email: normalizedEmail,
        bio: bio?.trim() || null,
        statusText: statusText?.trim() || null,
      },
      select: publicUserSelect,
    });

    res.json({ user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

router.post('/me/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Avatar file is required.' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatarUrl: true },
    });

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl },
      select: publicUserSelect,
    });

    const previousAvatarPath = getStoredAvatarPath(existingUser?.avatarUrl);
    if (previousAvatarPath && fs.existsSync(previousAvatarPath)) {
      fs.unlinkSync(previousAvatarPath);
    }

    res.json({ user });
  } catch (err) {
    console.error('Upload avatar error:', err);
    res.status(500).json({ error: err.message || 'Server error. Please try again.' });
  }
});

module.exports = router;
