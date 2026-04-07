const express = require('express');
const { body, validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;
const Candidate = require('../models/Candidate');
const Counter = require('../models/Counter');
const User = require('../models/User');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'du2ajmohg',
  api_key: process.env.CLOUDINARY_API_KEY || '298172688881969',
  api_secret: process.env.CLOUDINARY_API_SECRET || '-b7AhUe4OC3Z22_t7JIrBm7rtgo',
});

const router = express.Router();

// Rate limiting for candidate creation
const candidateCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many candidate submissions from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

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

// Sanitization helper
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, ''); // Remove potential XSS characters
};

// Deep sanitize object
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Calculate age from date of birth
const calculateAge = (dob) => {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
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
router.post('/', candidateCreationLimiter, [
  // Personal Info Validation
  body('personalInfo.firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters')
    .matches(/^[A-Za-z\s]+$/).withMessage('First name must contain only letters and spaces'),

  body('personalInfo.lastName')
    .trim()
    .optional({ checkFalsy: true })
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[A-Za-z\s]+$/).withMessage('Last name must contain only letters and spaces'),

  body('personalInfo.email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('personalInfo.phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[6-9]\d{9}$/).withMessage('Phone number must be exactly 10 digits and start with 6-9'),

  body('personalInfo.dateOfBirth')
    .notEmpty().withMessage('Date of birth is required')
    .isISO8601().withMessage('Date of birth must be a valid date')
    .custom((value) => {
      const age = calculateAge(value);
      if (age < 16 || age > 65) {
        throw new Error('Age must be between 16 and 65 years');
      }
      return true;
    }),

  body('personalInfo.address')
    .trim()
    .notEmpty().withMessage('Address is required')
    .isLength({ min: 5, max: 200 }).withMessage('Address must be between 5 and 200 characters'),

  // Education Info Validation
  body('educationInfo')
    .isArray({ min: 1 }).withMessage('At least one education record is required'),

  body('educationInfo.0.degree')
    .trim()
    .notEmpty().withMessage('Degree is required for the first education record'),

  body('educationInfo.0.institution')
    .trim()
    .notEmpty().withMessage('Institution is required for the first education record')
    .isLength({ min: 2 }).withMessage('Institution name must be at least 2 characters'),

  body('educationInfo.*.degree')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Degree must be between 2 and 100 characters'),

  body('educationInfo.*.institution')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 }).withMessage('Institution name must be between 2 and 200 characters'),

  body('educationInfo.*.yearOfCompletion')
    .optional()
    .isInt({ min: 1950, max: 2030 }).withMessage('Year of completion must be between 1950 and 2030'),

  body('educationInfo.*.grade')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('Grade must not exceed 20 characters'),

  // Job Info Validation
  body('jobInfo.position')
    .trim()
    .notEmpty().withMessage('Position is required')
    .isLength({ min: 2, max: 100 }).withMessage('Position must be between 2 and 100 characters'),

  body('jobInfo.experience')
    .isNumeric().withMessage('Experience must be a number')
    .isInt({ min: 0, max: 50 }).withMessage('Experience must be between 0 and 50 years'),

  body('jobInfo.expectedSalary')
    .optional()
    .isNumeric().withMessage('Expected salary must be a number')
    .isInt({ min: 0 }).withMessage('Expected salary must be a positive number'),

  body('jobInfo.applicationType')
    .trim()
    .notEmpty().withMessage('Application type is required')
    .isIn(['Job', 'Internship']).withMessage('Application type must be either "Job" or "Internship"'),

  body('jobInfo.paymentOption')
    .custom((value, { req }) => {
      if (req.body.jobInfo?.applicationType === 'Internship') {
        if (!value) {
          throw new Error('Payment option is required for Internship applications');
        }
        if (!['Free', 'Paid'].includes(value)) {
          throw new Error('Payment option must be "Free" or "Paid"');
        }
      }
      return true;
    }),
], async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors
    });
  }

  try {
    // Sanitize input to prevent XSS
    const sanitizedData = sanitizeObject(req.body);

    // Additional custom validation
    const { personalInfo, educationInfo, jobInfo } = sanitizedData;

    // Check for duplicate email
    const existingCandidate = await Candidate.findOne({ 'personalInfo.email': personalInfo.email });
    if (existingCandidate) {
      return res.status(400).json({
        success: false,
        message: 'A candidate with this email already exists'
      });
    }

    // Validate education info array
    for (let i = 0; i < educationInfo.length; i++) {
      if (!educationInfo[i].degree || !educationInfo[i].institution) {
        return res.status(400).json({
          success: false,
          message: `Education record ${i + 1}: Degree and institution are required`
        });
      }
    }

    // Generate interview ID and payment info
    const seq = await getNextSequence('candidate');
    const interviewId = buildInterviewId(seq);
    const paymentInfo = buildPaymentInfo(jobInfo.applicationType, jobInfo.paymentOption);

    // Create candidate
    const candidate = new Candidate({
      interviewId,
      ...sanitizedData,
      paymentInfo,
    });

    await candidate.save();

    res.status(201).json({
      success: true,
      message: 'Candidate created successfully',
      data: candidate
    });
  } catch (err) {
    console.error('Error creating candidate:', err.message);

    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error occurred while creating candidate'
    });
  }
});

// Upload payment screenshot to Cloudinary
router.post('/:id/upload-payment-proof', auth, async (req, res) => {
  const { paymentProof } = req.body;

  if (!paymentProof) {
    return res.status(400).json({
      success: false,
      message: 'Payment proof is required'
    });
  }

  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    const uploadResult = await cloudinary.uploader.upload(paymentProof, {
      folder: 'candidate_payment_screenshots',
    });

    candidate.paymentInfo.paymentProofUrl = uploadResult.secure_url;
    candidate.paymentInfo.paymentStatus = 'pending';
    await candidate.save();

    res.json({
      success: true,
      message: 'Payment proof uploaded successfully',
      data: candidate.paymentInfo
    });
  } catch (err) {
    console.error('Error uploading payment proof:', err.message);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while uploading payment proof'
    });
  }
});

// Admin update payment status
router.put('/:id/payment-approval', auth, requireAdmin, [
  body('paymentStatus')
    .trim()
    .notEmpty().withMessage('Payment status is required')
    .isIn(['pending', '50%', '100%']).withMessage('Payment status must be "pending", "50%", or "100%"'),
  body('approvalNotes')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Approval notes must not exceed 500 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors
    });
  }

  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Sanitize input
    const sanitizedStatus = sanitizeString(req.body.paymentStatus);
    const sanitizedNotes = req.body.approvalNotes ? sanitizeString(req.body.approvalNotes) : candidate.paymentInfo.approvalNotes;

    candidate.paymentInfo.paymentStatus = sanitizedStatus;
    candidate.paymentInfo.approvalNotes = sanitizedNotes;
    candidate.paymentInfo.approvedBy = req.user.id;
    await candidate.save();

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      data: candidate.paymentInfo
    });
  } catch (err) {
    console.error('Error updating payment status:', err.message);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while updating payment status'
    });
  }
});

// Update candidate
router.put('/:id', auth, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Sanitize input
    const sanitizedData = sanitizeObject(req.body);

    if (sanitizedData.paymentInfo && typeof sanitizedData.paymentInfo === 'object') {
      candidate.paymentInfo = candidate.paymentInfo || {};
      Object.entries(sanitizedData.paymentInfo).forEach(([key, value]) => {
        candidate.paymentInfo[key] = value;
      });
      delete sanitizedData.paymentInfo;
    }

    candidate.set(sanitizedData);
    await candidate.save();

    res.json({
      success: true,
      message: 'Candidate updated successfully',
      data: candidate
    });
  } catch (err) {
    console.error('Error updating candidate:', err.message);

    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error occurred while updating candidate'
    });
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