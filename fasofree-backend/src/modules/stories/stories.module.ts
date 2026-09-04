import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoriesService } from './stories.service';
import { StoriesController } from './stories.controller';
import { Story } from './entities/story.entity';
import { StoryView } from './entities/story-view.entity';
import { StoryLike } from './entities/story-like.entity';
import { Business } from '../businesses/entities/business.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Story, StoryView, StoryLike, Business, User])],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
