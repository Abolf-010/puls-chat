import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  userId!: string;

  /** Unique login handle — stored normalized lowercase */
  @Prop({ unique: true, required: true, lowercase: true, trim: true })
  username!: string;

  /** Shown in chats — not unique */
  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ required: true })
  password!: string;

  @Prop()
  socketId?: string;

  @Prop({ default: '' })
  profilePic?: string;

  @Prop({ default: '' })
  bio?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
