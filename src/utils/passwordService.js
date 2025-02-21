export class PasswordService {
  static generatePassword() {
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      const special = '!@#$%^&*';

      // Ensure one of each type
      let password = '';
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      password += numbers[Math.floor(Math.random() * numbers.length)];
      password += special[Math.floor(Math.random() * special.length)];

      // Fill the rest randomly
      const allChars = uppercase + lowercase + numbers + special;
      for (let i = password.length; i < 12; i++) {
          password += allChars[Math.floor(Math.random() * allChars.length)];
      }

      // Shuffle the password to make it more random
      return password
        .split('')
        .sort(() => Math.random() - 0.5)
        .join('');
  };
}

export const passwordService = new PasswordService();