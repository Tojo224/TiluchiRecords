import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatRequestDto } from "../dto/chat-request.dto";

export const ASSISTANT_DESTINATIONS = [
  "KARAOKE",
  "FACE_SWAP",
  "MUSIC_VIDEO",
  "FILES",
  "RESULTS",
  "PROJECTS",
  "NONE",
] as const;

export type AssistantDestination = (typeof ASSISTANT_DESTINATIONS)[number];
export type AssistantReply = { reply: string; destination: AssistantDestination };

type GeminiInteraction = {
  output_text?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

const SYSTEM_INSTRUCTION = `Eres el asistente conversacional de TiluchiRecords, un estudio creativo audiovisual.
Responde en español, con amabilidad y brevedad (máximo 90 palabras). Ayuda solo sobre estas funciones de la aplicación:
- Karaoke: recibe un video, genera una versión con voz separada/instrumental y letra sincronizada; también permite grabar una interpretación.
- Face swap: reemplaza uno o varios rostros seleccionados de un video usando una imagen fuente, con autorización.
- Video desde música: analiza una canción, crea un plan de escenas, genera clips y compone un videoclip.
- Archivos: carga de música, videos e imágenes y revisión de archivos cargados/generados.
- Resultados: reproducción y descarga de videos finales.
- Proyectos: listado y creación de proyectos.

La conversación anterior aparece abajo. No inventes funciones, estados de procesos, archivos ni resultados. No afirmes que ejecutaste acciones. Si la pregunta no trata de TiluchiRecords, indica amablemente que solo puedes orientar sobre la aplicación.

Devuelve exclusivamente un objeto JSON con las propiedades "reply" (respuesta al usuario) y "destination". "destination" debe ser exactamente uno de: KARAOKE, FACE_SWAP, MUSIC_VIDEO, FILES, RESULTS, PROJECTS, NONE. Usa NONE cuando no haya una pantalla clara que abrir. Nunca devuelvas rutas, URL, identificadores de proyecto ni datos personales.`;

const RESPONSE_FORMAT = {
  type: "text",
  mime_type: "application/json",
  schema: {
    type: "object",
    properties: {
      reply: { type: "string" },
      destination: { type: "string", enum: [...ASSISTANT_DESTINATIONS] },
    },
    required: ["reply", "destination"],
  },
};

@Injectable()
export class GeminiAssistantProvider {
  private readonly logger = new Logger(GeminiAssistantProvider.name);

  constructor(private readonly config: ConfigService) {}

  async respond(request: ChatRequestDto): Promise<AssistantReply> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY");
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "El asistente no está configurado en este momento.",
      );
    }

    const input = [
      ...(request.history || []).map((message) =>
        message.role === "assistant"
          ? {
              type: "model_output",
              content: [{ type: "text", text: message.content }],
            }
          : { type: "user_input", content: message.content },
      ),
      { type: "user_input", content: request.message.trim() },
    ];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
            "Api-Revision": "2026-05-20",
          },
          body: JSON.stringify({
            model: this.config.get<string>(
              "GEMINI_MODEL",
              "gemini-3.5-flash-lite",
            ),
            system_instruction: SYSTEM_INSTRUCTION,
            input,
            response_format: RESPONSE_FORMAT,
            generation_config: { max_output_tokens: 500 },
            store: false,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        // Never log provider bodies: they may contain prompts or account details.
        this.logger.warn(`Gemini request returned HTTP ${response.status}.`);
        throw new BadGatewayException(
          "No pude generar una respuesta ahora. Inténtalo de nuevo en un momento.",
        );
      }

      const interaction = (await response.json()) as GeminiInteraction;
      return this.parseReply(interaction);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (controller.signal.aborted) {
        throw new BadGatewayException(
          "La respuesta tardó demasiado. Inténtalo nuevamente.",
        );
      }
      this.logger.warn("Gemini request failed before a valid response arrived.");
      throw new BadGatewayException(
        "No pude conectar con el asistente. Inténtalo de nuevo en un momento.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseReply(interaction: GeminiInteraction): AssistantReply {
    const outputText =
      interaction.output_text ||
      interaction.steps
        ?.filter((step) => step.type === "model_output")
        .flatMap((step) => step.content || [])
        .filter((part) => part.type === "text")
        .map((part) => part.text || "")
        .join("");

    if (!outputText) {
      throw new BadGatewayException("El asistente devolvió una respuesta vacía.");
    }

    try {
      const parsed = JSON.parse(outputText) as Partial<AssistantReply>;
      const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
      const destination = ASSISTANT_DESTINATIONS.includes(
        parsed.destination as AssistantDestination,
      )
        ? (parsed.destination as AssistantDestination)
        : "NONE";
      if (!reply) throw new Error("Assistant reply was empty");
      return { reply: reply.slice(0, 1200), destination };
    } catch {
      throw new BadGatewayException(
        "El asistente no devolvió una respuesta válida. Inténtalo nuevamente.",
      );
    }
  }
}
