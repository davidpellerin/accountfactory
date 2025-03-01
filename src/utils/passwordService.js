import crypto from 'crypto';

export class PasswordService {
  static generatePassword(length = 12) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';

    // Helper function to securely get a random character from a string
    const getSecureRandomChar = (characterSet) => {
      const randomIndex = crypto.randomInt(characterSet.length);
      return characterSet[randomIndex];
    };

    // Ensure one of each required character type
    let password = '';
    password += getSecureRandomChar(uppercase);
    password += getSecureRandomChar(lowercase);
    password += getSecureRandomChar(numbers);
    password += getSecureRandomChar(special);

    // Fill the rest with random characters
    const allChars = uppercase + lowercase + numbers + special;
    for (let i = password.length; i < length; i++) {
      password += getSecureRandomChar(allChars);
    }

    // Securely shuffle the password
    // Fisher-Yates shuffle with cryptographically secure random numbers
    const passwordArray = password.split('');
    for (let i = passwordArray.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
    }

    return passwordArray.join('');
  }
}

export const passwordService = new PasswordService();