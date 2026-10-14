import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateLink } from './entities/affiliate-link.entity';
import { AffiliateEvent } from './entities/affiliate-event.entity';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';
import { AffiliateRedirectController } from './affiliate-redirect.controller';
import { Business } from '../businesses/entities/business.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AffiliateLink, AffiliateEvent, Business, User]),
  ],
  controllers: [AffiliateController, AffiliateRedirectController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
