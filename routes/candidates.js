const express = require('express');
const { body, validationResult } = require('express-validator');
const Candidate = require('../models/Candidate');
const Counter = require('../models/Counter');
const auth = require('../middleware/auth');

const router = express.Router();

const getNextSequence = async (name) => {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

const buildInterviewId = (seq) => {
  const roll = String(seq).padStart(4, '0');
  const year = 2026; // Fixed format: KT-{Roll_Number}-2026
  return `KT-${roll}-${year}`;
};

// Get all candidates (admin only)
router.get('/', auth, async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ submittedAt: -1 });
    res.json(candidates);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get single candidate
router.get('/:id', auth, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ msg: 'Candidate not found' });
    }
    res.json(candidate);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Create candidate
router.post('/', [
  body('personalInfo.firstName').notEmpty(),
  body('personalInfo.lastName').notEmpty(),
  body('personalInfo.email').isEmail(),
  body('personalInfo.phone').notEmpty(),
  body('personalInfo.address').notEmpty(),
  body('personalInfo.dateOfBirth').isISO8601(),
  body('educationInfo').isArray({ min: 1 }),
  body('jobInfo.position').notEmpty(),
  body('jobInfo.experience').isNumeric(),
  body('jobInfo.applicationType').isIn(['Job', 'Internship']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const seq = await getNextSequence('candidate');
    const interviewId = buildInterviewId(seq);

    const candidate = new Candidate({
      interviewId,
      ...req.body,
    });

    await candidate.save();
    res.json(candidate);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Update candidate
router.put('/:id', auth, async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!candidate) {
      return res.status(404).json({ msg: 'Candidate not found' });
    }
    res.json(candidate);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Delete candidate
router.delete('/:id', auth, async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (!candidate) {
      return res.status(404).json({ msg: 'Candidate not found' });
    }
    res.json({ msg: 'Candidate removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;