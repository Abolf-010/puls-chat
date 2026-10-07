import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SessionService } from "./session.service";
import { Session, SessionSchema } from "./schmas/session.schma";


@Module({
    imports:[
        MongooseModule.forFeature([{
            name:Session.name,
            schema:SessionSchema
        }
    ])
    ],
    providers:[SessionService],
    exports:[SessionService]
})
export class SessionModule{}