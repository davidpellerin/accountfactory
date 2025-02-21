import { describe, expect, test } from '@jest/globals';
import { PasswordService } from './passwordService.js';

describe('PasswordService', () => {
  describe('generatePassword', () => {
    test('should generate a password with length of 12 characters', () => {
      const password = PasswordService.generatePassword();
      expect(password).toHaveLength(12);
    });

    test('should include at least one uppercase letter', () => {
      const password = PasswordService.generatePassword();
      expect(password).toMatch(/[A-Z]/);
    });

    test('should include at least one lowercase letter', () => {
      const password = PasswordService.generatePassword();
      expect(password).toMatch(/[a-z]/);
    });

    test('should include at least one number', () => {
      const password = PasswordService.generatePassword();
      expect(password).toMatch(/[0-9]/);
    });

    test('should include at least one special character', () => {
      const password = PasswordService.generatePassword();
      expect(password).toMatch(/[!@#$%^&*]/);
    });

    test('should generate different passwords on subsequent calls', () => {
      const password1 = PasswordService.generatePassword();
      const password2 = PasswordService.generatePassword();
      expect(password1).not.toBe(password2);
    });

    test('should only contain valid characters', () => {
      const password = PasswordService.generatePassword();
      expect(password).toMatch(/^[A-Za-z0-9!@#$%^&*]+$/);
    });
  });
});
