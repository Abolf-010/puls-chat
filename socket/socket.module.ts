import { Module } from "@nestjs/common";
import { SocketManager } from "./socket.manage";

@Module({
    providers:[
       SocketManager
    ]
})
export class socketModul{}