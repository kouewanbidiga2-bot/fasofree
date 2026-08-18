import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
  UseGuards,
  Query,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { STORAGE_DRIVER } from './upload.module';
import { IStorageDriver, UploadedFileResult } from './interfaces/storage-driver.interface';

@ApiTags('Uploads')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('uploads')
export class UploadController {
  constructor(
    @Inject(STORAGE_DRIVER)
    private readonly storageDriver: IStorageDriver,
  ) {}

  @Post('image')
  @ApiOperation({ summary: 'Uploader une image (JPEG, PNG, WebP — max 5 Mo)' })
  @ApiQuery({ name: 'folder', required: false })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploadée avec succès' })
  @ApiResponse({ status: 400, description: 'Type non supporté ou fichier trop volumineux' })
  @UseInterceptors(FileInterceptor('file', { storage: undefined }))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/i,
        })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
          exceptionFactory: (errorMsg) => {
            if (errorMsg.includes('file type')) {
              throw new BadRequestException(
                'Type de fichier non supporté. Formats acceptés: JPEG, PNG, WebP',
              );
            }
            if (errorMsg.includes('size')) {
              throw new BadRequestException(
                'Fichier trop volumineux. Taille maximale: 5 Mo',
              );
            }
            throw new BadRequestException(errorMsg);
          },
        }),
    )
    file: Express.Multer.File,
    @Query('folder') folder = 'general',
  ): Promise<UploadedFileResult> {
    return this.storageDriver.uploadFile(file, folder);
  }
}
