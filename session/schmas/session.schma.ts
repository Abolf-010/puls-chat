import { Prop,Schema,SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type SessionDocument=HydratedDocument<Session>;

@Schema({timestamps:true})
export class Session{
    @Prop({
        ref:'User',
        required:true
    })
    userId!:string;
    @Prop({
        required:true
    })
    refreshTokenHash!:string;
    @Prop()
    device!:string;
    @Prop()
    userAgent?:string;
    @Prop()
    expiersAt!:Date;
    @Prop()
    revokedAt!:string;
}

export const SessionSchema=SchemaFactory.createForClass(Session)