import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ChatRequestDto } from "../dto/chat-request.dto";
import {
  AssistantReply,
  GeminiAssistantProvider,
} from "./gemini-assistant.provider";

@Injectable()
export class AssistantService {
  private readonly requestTimes = new Map<string, number[]>();

  constructor(private readonly gemini: GeminiAssistantProvider) {}

  async chat(userId: string, request: ChatRequestDto): Promise<AssistantReply> {
    const now = Date.now();
    const recent = (this.requestTimes.get(userId) || []).filter(
      (timestamp) => now - timestamp < 60_000,
    );
    if (recent.length >= 15) {
      throw new HttpException(
        "Llegaste al límite temporal de mensajes. Espera un minuto y vuelve a intentarlo.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.requestTimes.set(userId, recent);
    return this.gemini.respond(request);
  }
}
