const { validationResult } = require('express-validator');

/**
 * Middleware: Checks express-validator results and returns 400 if invalid.
 * Use as a middleware in route chain, NOT as a function call.
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Helper function version (for routes that call it inline).
 * Returns null if valid, sends 400 response if invalid.
 */
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  return null;
};

module.exports = { handleValidation, handleValidationErrors };
