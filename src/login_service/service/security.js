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
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .substring(0, 1000);
}

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {object} - {isValid: boolean, error?: string}
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username is required' };
  }

  const sanitized = sanitizeInput(username);

  if (sanitized.length > 20) {
    return { isValid: false, error: 'Username is too long (max 20 characters)' };
  }

  if (sanitized.includes('>') || sanitized.includes('<')) {
    return { isValid: false, error: 'Invalid username format' };
  }

  return { isValid: true, sanitized };
}

/**
 * Validate password
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
    return {
      isValid: false,
      error: 'Password is too long (max 128 characters)',
    };
  }

  // if (password.length < 8) {
  //   return {
  //     isValid: false,
  //     error: 'Password needs to be at least 8 characters',
  //   };
  // }
  // if (!/\d/.test(password)) {
  //   return { isValid: false, error: 'Password needs at least one number' };
  // }
  // if (!/[A-Z]/.test(password)) {
  //   return {
  //     isValid: false,
  //     error: 'Password needs at least one uppercase letter',
  //   };
  // }
  // if (!/[!@#$%^&*]/.test(password)) {
  //   return {
  //     isValid: false,
  //     error: 'Password needs at least one special character',
  //   };
  // }

  return { isValid: true };
}

/**
 * Validate request body for login/registration
 * @param {object} body - Request body
 * @returns {object} - {isValid: boolean, sanitizedData?: object, errors?: string[]}
 */
function validateAuthRequest(body) {
  const errors = [];
  const sanitizedData = {};

  const usernameValidation = validateUsername(body?.username);
  if (!usernameValidation.isValid) {
    errors.push(usernameValidation.error);
  } else {
    sanitizedData.username = usernameValidation.sanitized;
  }

  const passwordValidation = validatePassword(body?.password);
  if (!passwordValidation.isValid) {
    errors.push(passwordValidation.error);
  } else {
    sanitizedData.password = body.password;
  }

  return {
    isValid: errors.length === 0,
    sanitizedData: errors.length === 0 ? sanitizedData : undefined,
    errors,
  };
}

module.exports = {
  sanitizeInput,
  validateUsername,
  validatePassword,
  validateAuthRequest,
};
