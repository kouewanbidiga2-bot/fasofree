import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

describe('Authentication DTO validation', () => {
  it('accepts valid login credentials', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'client@fasofree.bf',
      password: 'MotDePasseFort123!',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects an invalid registration payload', async () => {
    const dto = plainToInstance(RegisterDto, {
      fullName: 'A',
      email: 'invalide',
      phone: 'abc',
      password: 'court',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(4);
  });
});
