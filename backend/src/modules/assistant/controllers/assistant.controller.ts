import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ChatRequestDto } from "../dto/chat-request.dto";
import { AssistantService } from "../services/assistant.service";

@Controller("assistant")
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post("chat")
  chat(@CurrentUser("id") userId: string, @Body() request: ChatRequestDto) {
    return this.assistant.chat(userId, request);
  }
}
