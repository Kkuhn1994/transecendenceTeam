import { SecurityValidator, VALIDATION_RULES } from './security';

interface LoginRequest {
  email: string;
  password: string;
  otp?: string;
}

interface LoginResponse {
  status: string;
  email?: string;
  userId?: number;
  error?: string;
}

async function createUser(email: string, password: string): Promise<LoginResponse> {
  const body: LoginRequest = { email, password };

  try {
    const response = await fetch('/login_service/createAccount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (data.qr) {
      const img = document.createElement('img');
      img.src = data.qr;
      img.alt = '2FA QR Code';
      img.style.width = '200px';

      document.getElementById('qr-container')!.appendChild(img);
    }
    return data;
  } catch (err) {
    console.error('Create user failed:', err);
    return { status: 'error', error: (err as Error).message };
  }
}

async function loginUser(email: string, password: string, otp: string): Promise<LoginResponse> {
  const body: LoginRequest = { email, password, otp };

  try {
    const response = await fetch('/login_service/loginAccount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Login failed:', err);
    return { status: 'error', error: (err as Error).message };
  }
}

// Utility functions for form error handling
function addErrorDisplayElements(form: HTMLFormElement): void {
  // Add general error display if not exists
  if (!form.querySelector('.error-display')) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-display';
    errorDiv.style.cssText = `
      color: #ff6b6b;
      background: rgba(255, 107, 107, 0.1);
      border: 1px solid rgba(255, 107, 107, 0.3);
      border-radius: 4px;
      padding: 10px;
      margin-bottom: 15px;
      display: none;
      font-size: 14px;
    `;
    form.insertBefore(errorDiv, form.firstChild);
  }

  // Add success message display if not exists
  if (!form.querySelector('.success-display')) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-display';
    successDiv.style.cssText = `
      color: #51cf66;
      background: rgba(81, 207, 102, 0.1);
      border: 1px solid rgba(81, 207, 102, 0.3);
      border-radius: 4px;
      padding: 10px;
      margin-bottom: 15px;
      display: none;
      font-size: 14px;
    `;
    form.insertBefore(successDiv, form.firstChild);
  }
}

function clearFormErrors(form: HTMLFormElement): void {
  const errorDisplay = form.querySelector('.error-display') as HTMLElement;
  const successDisplay = form.querySelector('.success-display') as HTMLElement;
  
  if (errorDisplay) {
    errorDisplay.style.display = 'none';
    errorDisplay.textContent = '';
  }
  
  if (successDisplay) {
    successDisplay.style.display = 'none';
    successDisplay.textContent = '';
  }

  // Remove field-specific error styling
  const inputs = form.querySelectorAll('input');
  inputs.forEach(input => {
    input.style.borderColor = '';
  });
}

function displayFormErrors(form: HTMLFormElement, errors: Record<string, string>): void {
  const errorDisplay = form.querySelector('.error-display') as HTMLElement;
  
  if (errorDisplay) {
    // Get the first error only
    const [firstField, firstMessage] = Object.entries(errors)[0];
    
    // Highlight the problematic input field
    const input = form.querySelector(`#${form.id.replace('Form', '')}${firstField.charAt(0).toUpperCase() + firstField.slice(1)}`) as HTMLInputElement;
    if (input && firstField !== 'general') {
      input.style.borderColor = '#ff6b6b';
    }
    
    // Display only the first error message
    const displayMessage = firstField === 'general' ? firstMessage : firstMessage;
    SecurityValidator.safeSetText(errorDisplay, displayMessage);
    errorDisplay.style.display = 'block';
  }
}

function displaySuccessMessage(form: HTMLFormElement, message: string): void {
  const successDisplay = form.querySelector('.success-display') as HTMLElement;
  
  if (successDisplay) {
    SecurityValidator.safeSetText(successDisplay, message);
    successDisplay.style.display = 'block';
  }
}

export function initLoginAndRegister() {
  const route = location.hash.replace('#', '') || '/';

  if (route === '/') {
    const form = document.getElementById('loginForm') as HTMLFormElement | null;
    const emailInput = document.getElementById('loginEmail') as HTMLInputElement | null;
    const passwordInput = document.getElementById('loginPassword') as HTMLInputElement | null;
    const otpInput = document.getElementById('otp') as HTMLInputElement | null;

    if (!form || !emailInput || !passwordInput) return;

    // Add error display elements
    addErrorDisplayElements(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Clear previous errors
      clearFormErrors(form);
      
      // Get sanitized input values
      const email = SecurityValidator.sanitizeInput(emailInput.value.trim());
      const password = passwordInput.value; // Don't sanitize passwords, just validate length
      const otp = otpInput!.value;
      
      // Validate form data
      const errors = SecurityValidator.validateForm(
        { email, password, otp },
        { 
          email: VALIDATION_RULES.email,
          password: VALIDATION_RULES.password,
          otp : VALIDATION_RULES.password
        }
      );
      
      if (Object.keys(errors).length > 0) {
        displayFormErrors(form, errors);
        return;
      }

      // Proceed with login
      const res = await loginUser(email, password, otp);

      if (res.status === 'ok') {
        location.hash = '#/home';
      } else {
        displayFormErrors(form, { general: res.error || 'Login failed' });
      }
    });
  }

  if (route === '/register') {
    const form = document.getElementById('registerForm') as HTMLFormElement | null;
    const emailInput = document.getElementById('registerEmail') as HTMLInputElement | null;
    const passwordInput = document.getElementById('registerPassword') as HTMLInputElement | null;

    if (!form || !emailInput || !passwordInput) return;

    // Add error display elements
    addErrorDisplayElements(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Clear previous errors
      clearFormErrors(form);
      
      // Get sanitized input values
      const email = SecurityValidator.sanitizeInput(emailInput.value.trim());
      const password = passwordInput.value;
      
      // Validate form data
      const errors = SecurityValidator.validateForm(
        { email, password },
        { 
          email: VALIDATION_RULES.email,
          password: VALIDATION_RULES.password
        }
      );
      
      if (Object.keys(errors).length > 0) {
        displayFormErrors(form, errors);
        return;
      }

      // Proceed with registration
      const res = await createUser(email, password);

      if (res.status === 'ok') {
        displaySuccessMessage(form, 'Account created successfully! Pls scan the QR-Code for 2-FA then you can log in');
        // setTimeout(() => {
        //   location.hash = '#/';
        // }, 2000);
      } else {
        displayFormErrors(form, { general: res.error || 'Registration failed' });
      }
    });
  }
}
