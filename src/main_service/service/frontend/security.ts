/**
 * Security utilities for input validation and sanitization
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => string | null;
}

export interface ValidationRules {
  [fieldName: string]: ValidationRule;
}

export class SecurityValidator {
  // Sanitize input to prevent XSS
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
      .trim()
      .substring(0, 1000); // Limit length as failsafe
  }

  // Validate email format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  // Validate password - basic validation only
  static validatePassword(password: string): string | null {
    if (password.length < 1) {
      return 'Password is required';
    }
    if (password.length > 128) {
      return 'Password is too long (max 128 characters)';
    }
    return null;
  }

  // Validate single field
  static validateField(value: string, rules: ValidationRule): string | null {
    const sanitizedValue = this.sanitizeInput(value);
    
    if (rules.required && !sanitizedValue) {
      return 'This field is required';
    }

    if (rules.minLength && sanitizedValue.length < rules.minLength) {
      return `Must be at least ${rules.minLength} characters long`;
    }

    if (rules.maxLength && sanitizedValue.length > rules.maxLength) {
      return `Must be no more than ${rules.maxLength} characters long`;
    }

    if (rules.pattern && !rules.pattern.test(sanitizedValue)) {
      return 'Invalid format';
    }

    if (rules.customValidator) {
      return rules.customValidator(sanitizedValue);
    }

    return null;
  }

  // Validate entire form
  static validateForm(formData: Record<string, string>, rules: ValidationRules): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const [fieldName, value] of Object.entries(formData)) {
      if (rules[fieldName]) {
        const error = this.validateField(value, rules[fieldName]);
        if (error) {
          errors[fieldName] = error;
        }
      }
    }

    return errors;
  }

  // Safe text output - always use textContent
  static safeSetText(element: HTMLElement, text: string): void {
    element.textContent = this.sanitizeInput(text);
  }

  // Safe HTML output - very limited, only for known safe content
  static safeSetHTML(element: HTMLElement, html: string): void {
    // Only allow very basic formatting
    const allowedTags = /<\/?[bi]>/g;
    const cleanHTML = html
      .replace(/<(?!\/?[bi]>)[^>]*>/g, '') // Remove all tags except <b>, <i>, </b>, </i>
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');
    
    element.innerHTML = cleanHTML;
  }
}

// Form validation rules
export const VALIDATION_RULES = {
  email: {
    required: true,
    maxLength: 254,
    customValidator: (value: string) => {
      // Very permissive - just needs @ and . somewhere
      return (value.includes('@') && value.includes('.')) ? null : 'Please enter a valid email address';
    }
  },
  password: {
    required: true,
    minLength: 1,
    maxLength: 128,
    customValidator: SecurityValidator.validatePassword
  },
  alias: {
    required: true,
    minLength: 1,
    maxLength: 50
  }
} as const;