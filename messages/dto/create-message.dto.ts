import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  content!: string;

  @IsOptional()
  @IsIn(['text', 'image', 'file', 'audio', 'video', 'system'])
  type?: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';

  @IsOptional()
  @IsString()
  replyToMessageId?: string;

  @IsOptional()
  @IsString()
  clientMessageId?: string;
}

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  messageId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  content!: string;
}
