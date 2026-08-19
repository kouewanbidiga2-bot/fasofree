import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { parsePhoneNumber } from 'libphonenumber-js';

@ValidatorConstraint({ name: 'IsBurkinaPhone', async: false })
export class IsBurkinaPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (!value) return false;
    const cleaned = value.replace(/[\s\-()]/g, '');
    try {
      const phone = parsePhoneNumber(cleaned, 'BF');
      if (phone && phone.isValid()) {
        return true;
      }
      if (/^\+226[56789]\d{7}$/.test(cleaned)) {
        return true;
      }
      if (/^[56789]\d{7}$/.test(cleaned)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'Numéro de téléphone invalide. Format accepté: +226XXXXXXXX ou 8 chiffres (Burkina Faso)';
  }
}

export function IsBurkinaPhone(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'IsBurkinaPhone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsBurkinaPhoneConstraint,
    });
  };
}
