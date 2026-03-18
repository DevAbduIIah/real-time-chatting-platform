const express = require('express');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all users except the current user
router.get('/', auth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
