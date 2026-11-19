import { Module } from "@nestjs/common";
import { AssistantController } from "./controllers/assistant.controller";
import { AssistantService } from "./services/assistant.service";
import { GeminiAssistantProvider } from "./services/gemini-assistant.provider";

@Module({
  controllers: [AssistantController],
  providers: [AssistantService, GeminiAssistantProvider],
})
export class AssistantModule {}
