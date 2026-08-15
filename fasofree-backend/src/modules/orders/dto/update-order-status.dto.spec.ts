import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateOrderStatusDto } from './update-order-status.dto';
import { OrderStatus } from '../entities/order.entity';

describe('UpdateOrderStatusDto', () => {
  it('only accepts known order statuses', async () => {
    const valid = plainToInstance(UpdateOrderStatusDto, {
      status: OrderStatus.PAID,
    });
    const invalid = plainToInstance(UpdateOrderStatusDto, { status: 'HACKED' });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });
});
