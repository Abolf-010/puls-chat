import { Injectable } from "@nestjs/common";

@Injectable()
export class SocketManager{
    private readonly userToSocket=new Map<number,string>()
    private readonly socketToUser=new Map<string,number>()

    lastItem(){
        const last =Array.from(this.socketToUser.entries()).pop();
        return last;
         
    }
    register(userID:number,socketId:string){
        //  .log(userID+"\n"+socketId)
        this.socketToUser.set(socketId,userID)
        this.userToSocket.set(userID,socketId)
    }
    getSocketId(userID:number){
        return this.userToSocket.get(userID)
    }

    getUserId(socketId:string){
        //  .log(this.socketToUser.get(socketId)+' asdf');
        return this.socketToUser.get(socketId)

    }
    remove(socketId:string){
        const userId=this.socketToUser.get(socketId);
        if(!userId){
            return false;
        }else{
            this.userToSocket.delete(userId);
            this.socketToUser.delete(socketId   );
        }
    }
    
}
