import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StoriesService } from './stories.service';
import { StoryMediaType } from './entities/story.entity';

@ApiTags('Stories')
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get active stories grouped by business' })
  async getActiveStories(@Req() req: any) {
    const userId = req.user?.userId;
    const stories = await this.storiesService.getActiveStories(userId);
    return { success: true, data: stories };
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Create a story (merchant only)' })
  async createStory(
    @Body() body: { businessId: string; mediaUrl: string; mediaType?: string; caption?: string },
    @Req() req: any,
  ) {
    const story = await this.storiesService.createStory(
      body.businessId,
      req.user.userId,
      req.user.role,
      body.mediaUrl,
      (body.mediaType as StoryMediaType) || StoryMediaType.IMAGE,
      body.caption,
    );
    return { success: true, data: story };
  }

  @Post(':id/view')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Mark a story as viewed' })
  async viewStory(@Param('id') id: string, @Req() req: any) {
    await this.storiesService.viewStory(id, req.user.userId);
    return { success: true };
  }

  @Get(':id/viewers')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get story viewers (owner only)' })
  async getStoryViewers(@Param('id') id: string, @Req() req: any) {
    const viewers = await this.storiesService.getStoryViewers(id, req.user.userId);
    return { success: true, data: viewers };
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Delete a story (owner only)' })
  async deleteStory(@Param('id') id: string, @Req() req: any) {
    await this.storiesService.deleteStory(id, req.user.userId);
    return { success: true };
  }
}
