/**
 * Backend Security Validation Utilities
 */

/**
 * Sanitize string input to prevent injection attacks
 * @param {string} input - The input to sanitize
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
    .trim()
    .substring(0, 1000); // Limit length as failsafe
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {object} - {isValid: boolean, error?: string}
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const sanitized = sanitizeInput(email);
  
  if (sanitized.length > 254) {
    return { isValid: false, error: 'Email is too long (max 254 characters)' };
  }

  // Simple email validation - just needs @ and . 
  if (!sanitized.includes('@') || !sanitized.includes('.')) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true, sanitized };
}

/**
 * Validate password - basic validation only per subject requirements
 * @param {string} password - Password to validate
 * @returns {object} - {isValid: boolean, error?: string}
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 1) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length > 128) {
    return { isValid: false, error: 'Password is too long (max 128 characters)' };
  }

  return { isValid: true };
}

/**
 * Rate limiting utility - simple in-memory store
 */

/**
 * Validate request body for login/registration
 * @param {object} body - Request body
 * @returns {object} - {isValid: boolean, sanitizedData?: object, errors?: string[]}
 */
function validateAuthRequest(body) {
  const errors = [];
  const sanitizedData = {};

  // Validate email
  const emailValidation = validateEmail(body?.email);
  if (!emailValidation.isValid) {
    errors.push(emailValidation.error);
  } else {
    sanitizedData.email = emailValidation.sanitized;
  }

  // Validate password - basic validation only
  const passwordValidation = validatePassword(body?.password);
  if (!passwordValidation.isValid) {
    errors.push(passwordValidation.error);
  } else {
    sanitizedData.password = body.password; // Don't sanitize passwords
  }

  return {
    isValid: errors.length === 0,
    sanitizedData: errors.length === 0 ? sanitizedData : undefined,
    errors
  };
}

module.exports = {
  sanitizeInput,
  validateEmail,
  validatePassword,
  validateAuthRequest
};