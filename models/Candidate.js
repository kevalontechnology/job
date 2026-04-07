const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  interviewId: { type: String, unique: true, required: true, trim: true },
  personalInfo: {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{10}$/, 'Please enter a valid 10-digit phone number']
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    dateOfBirth: { type: Date, required: true },
  },
  educationInfo: [{
    degree: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    institution: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    yearOfCompletion: { type: Number, required: true },
    grade: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    },
  }],
  jobInfo: {
    position: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    experience: { type: Number, required: true },
    expectedSalary: { type: Number },
    applicationType: { type: String, required: true, enum: ['Job', 'Internship'] },
    paymentOption: { type: String, enum: ['Free', 'Paid'] },
  },
  paymentInfo: {
    internshipType: { type: String, enum: ['Free', 'Paid'] },
    amount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['pending', '50%', '100%'], default: 'pending' },
    paymentProofUrl: {
      type: String,
      trim: true,
      maxlength: 500
    },
    approvalNotes: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  status: { type: String, default: 'pending' }, // pending, approved, rejected
  evaluation: {
    theory: {
      marks: { type: Number, min: 0, max: 100 },
      notes: {
        type: String,
        trim: true,
        maxlength: 1000
      }
    },
    practical: {
      marks: { type: Number, min: 0, max: 100 },
      notes: {
        type: String,
        trim: true,
        maxlength: 1000
      }
    }
  },
  submittedAt: { type: Date, default: Date.now },
});

// Add indexes for frequently queried fields
candidateSchema.index({ 'personalInfo.email': 1 });
candidateSchema.index({ status: 1 });
candidateSchema.index({ submittedAt: -1 });
candidateSchema.index({ interviewId: 1 });

module.exports = mongoose.model('Candidate', candidateSchema);