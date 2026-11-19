import { BadGatewayException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatRequestDto } from "../dto/chat-request.dto";
import { GeminiAssistantProvider } from "./gemini-assistant.provider";

describe("GeminiAssistantProvider", () => {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === "GEMINI_API_KEY") return "test-key";
      if (key === "GEMINI_MODEL") return "gemini-test-model";
      return fallback;
    }),
  } as unknown as ConfigService;
  const provider = new GeminiAssistantProvider(config);
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("returns Gemini's conversational answer and a supported navigation intent", async () => {
    const requestBody: any = {};
    global.fetch = jest.fn(async (_input, init) => {
      requestBody.headers = init?.headers;
      requestBody.body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          steps: [
            {
              type: "model_output",
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    reply: "Te llevo a Karaoke.",
                    destination: "KARAOKE",
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const dto = {
      message: "Quiero preparar un karaoke",
      history: [{ role: "user", content: "Hola" }],
    } as ChatRequestDto;
    await expect(provider.respond(dto)).resolves.toEqual({
      reply: "Te llevo a Karaoke.",
      destination: "KARAOKE",
    });
    expect(requestBody.headers["x-goog-api-key"]).toBe("test-key");
    expect(requestBody.body.model).toBe("gemini-test-model");
    expect(requestBody.body.store).toBe(false);
    expect(requestBody.body.input.at(-1).content).toBe(dto.message);
  });

  it("rejects malformed model output", async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({ output_text: "not-json" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as typeof fetch;
    await expect(provider.respond({ message: "Hola" })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it("converts an unapproved model destination to NONE", async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            reply: "No abriré una ruta externa.",
            destination: "https://malicious.example",
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as typeof fetch;

    await expect(provider.respond({ message: "Abre esto" })).resolves.toEqual({
      reply: "No abriré una ruta externa.",
      destination: "NONE",
    });
  });
});
