const express = require('express');
const { body, validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;
const Candidate = require('../models/Candidate');
const Counter = require('../models/Counter');
const User = require('../models/User');
const auth = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'du2ajmohg',
  api_key: process.env.CLOUDINARY_API_KEY || '298172688881969',
  api_secret: process.env.CLOUDINARY_API_SECRET || '-b7AhUe4OC3Z22_t7JIrBm7rtgo',
});

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

const buildPaymentInfo = (applicationType, paymentOption) => {
  if (applicationType !== 'Internship') {
    return {
      internshipType: undefined,
      amount: 0,
      paymentStatus: 'pending',
    };
  }

  const option = paymentOption === 'Paid' ? 'Paid' : 'Free';
  const amount = option === 'Paid' ? 4999 : 0;
  return {
    internshipType: option,
    amount,
    paymentStatus: 'pending',
  };
};

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ msg: 'Admin access required' });
    }
    req.user.role = user.role;
    next();
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
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
  body('jobInfo.paymentOption').custom((value, { req }) => {
    if (req.body.jobInfo?.applicationType === 'Internship') {
      if (!value) {
        throw new Error('Payment option is required for Internship applications');
      }
      if (!['Free', 'Paid'].includes(value)) {
        throw new Error('Payment option must be Free or Paid');
      }
    }
    return true;
  }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const seq = await getNextSequence('candidate');
    const interviewId = buildInterviewId(seq);
    const paymentInfo = buildPaymentInfo(req.body.jobInfo.applicationType, req.body.jobInfo.paymentOption);

    const candidate = new Candidate({
      interviewId,
      ...req.body,
      paymentInfo,
    });

    await candidate.save();
    res.json(candidate);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Upload payment screenshot to Cloudinary
router.post('/:id/upload-payment-proof', auth, async (req, res) => {
  const { paymentProof } = req.body;

  if (!paymentProof) {
    return res.status(400).json({ msg: 'paymentProof is required' });
  }

  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ msg: 'Candidate not found' });
    }

    const uploadResult = await cloudinary.uploader.upload(paymentProof, {
      folder: 'candidate_payment_screenshots',
    });

    candidate.paymentInfo.paymentProofUrl = uploadResult.secure_url;
    candidate.paymentInfo.paymentStatus = 'pending';
    await candidate.save();

    res.json(candidate.paymentInfo);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Admin update payment status
router.put('/:id/payment-approval', auth, requireAdmin, [
  body('paymentStatus').isIn(['pending', '50%', '100%']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ msg: 'Candidate not found' });
    }

    candidate.paymentInfo.paymentStatus = req.body.paymentStatus;
    candidate.paymentInfo.approvalNotes = req.body.approvalNotes || candidate.paymentInfo.approvalNotes;
    candidate.paymentInfo.approvedBy = req.user.id;
    await candidate.save();

    res.json(candidate.paymentInfo);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Update candidate
router.put('/:id', auth, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ msg: 'Candidate not found' });
    }

    if (req.body.paymentInfo && typeof req.body.paymentInfo === 'object') {
      candidate.paymentInfo = candidate.paymentInfo || {};
      Object.entries(req.body.paymentInfo).forEach(([key, value]) => {
        candidate.paymentInfo[key] = value;
      });
      delete req.body.paymentInfo;
    }

    candidate.set(req.body);
    await candidate.save();

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