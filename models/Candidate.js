const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  interviewId: { type: String, unique: true, required: true },
  personalInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
  },
  educationInfo: [{
    degree: { type: String, required: true },
    institution: { type: String, required: true },
    yearOfCompletion: { type: Number, required: true },
    grade: { type: String, required: true },
  }],
  jobInfo: {
    position: { type: String, required: true },
    experience: { type: Number, required: true },
    expectedSalary: { type: Number },
    applicationType: { type: String, required: true, enum: ['Job', 'Internship'] },
  },
  status: { type: String, default: 'pending' }, // pending, approved, rejected
  evaluation: {
    theory: {
      marks: { type: Number, min: 0, max: 100 },
      notes: { type: String }
    },
    practical: {
      marks: { type: Number, min: 0, max: 100 },
      notes: { type: String }
    }
  },
  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Candidate', candidateSchema);