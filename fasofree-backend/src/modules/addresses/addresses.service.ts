import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAddress } from './entities/user-address.entity';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(UserAddress)
    private readonly addressRepo: Repository<UserAddress>,
  ) {}

  async findAllByUser(userId: string): Promise<UserAddress[]> {
    return this.addressRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async create(userId: string, dto: CreateAddressDto): Promise<UserAddress> {
    if (dto.isDefault) {
      await this.addressRepo.update({ userId, isDefault: true }, { isDefault: false });
    }
    const address = this.addressRepo.create({ userId, ...dto });
    return this.addressRepo.save(address);
  }

  async update(userId: string, addressId: string, dto: UpdateAddressDto): Promise<UserAddress> {
    const address = await this.addressRepo.findOne({ where: { id: addressId } });
    if (!address) throw new NotFoundException('Adresse introuvable');
    if (address.userId !== userId) throw new ForbiddenException('Acces refuse');

    if (dto.isDefault) {
      await this.addressRepo.update({ userId, isDefault: true }, { isDefault: false });
    }

    Object.assign(address, dto);
    return this.addressRepo.save(address);
  }

  async remove(userId: string, addressId: string): Promise<{ message: string }> {
    const address = await this.addressRepo.findOne({ where: { id: addressId } });
    if (!address) throw new NotFoundException('Adresse introuvable');
    if (address.userId !== userId) throw new ForbiddenException('Acces refuse');

    await this.addressRepo.remove(address);
    return { message: 'Adresse supprimee' };
  }
}
