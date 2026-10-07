import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User,UserSchema } from "./schemas/user.schema";
import { UserController } from "./user.controller";
import { userService } from "./user.service";
import { createUserDto } from "./dto/create-user.dto";

@Module({
    imports:[
        MongooseModule.forFeature([
            {
                name:User.name,
                schema:UserSchema
            }
        ])
    ],
    providers:[userService],
    controllers:[UserController]

})
export class UserModule{}