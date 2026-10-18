import { Module } from "@nestjs/common";
import { ConsentsController } from "./controllers/consents.controller";
import { ConsentsService } from "./services/consents.service";

@Module({
  controllers: [ConsentsController],
  providers: [ConsentsService],
  exports: [ConsentsService],
})
export class ConsentsModule {}
