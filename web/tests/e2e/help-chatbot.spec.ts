import { expect, test } from "@playwright/test";

const projectId = "chatbot-navigation-project";

test("el chatbot conversa con Gemini y sus acciones navegan a rutas permitidas", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("tiluchi_token", "e2e-token"));
  await page.route("**/api/v1/users/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "e2e-user",
        email: "chatbot-e2e@example.com",
        name: "Prueba Chatbot",
        role: "USER",
      }),
    }),
  );
  await page.route(`**/api/v1/projects/${projectId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: projectId,
        name: "Proyecto de navegación",
        description: "Prueba automatizada",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mediaAssets: [],
        jobs: [],
      }),
    }),
  );

  const receivedMessages: Array<{ message: string; history: unknown[] }> = [];
  await page.route("**/api/v1/assistant/chat", async (route) => {
    const body = route.request().postDataJSON();
    receivedMessages.push(body);
    const lowered = String(body.message).toLowerCase();
    const response = lowered.includes("face")
      ? { reply: "Te llevo a Face swap. Elige el rostro y el video que usarás.", destination: "FACE_SWAP" }
      : {
          reply: "Puedes revisar el resultado final desde esa sección.",
          destination: "RESULTS",
        };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  await page.goto(`/projects/${projectId}`);
  await expect(page.getByText("Proyecto de navegación")).toBeVisible();
  const openAssistant = async () => {
    await page.getByRole("button", { name: "Abrir asistente de ayuda" }).click();
    return page.getByRole("region", { name: "Chat de ayuda" });
  };

  let chat = await openAssistant();
  await chat.getByRole("button", { name: "Karaoke" }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/karaoke$`));

  chat = await openAssistant();
  await chat.getByLabel("Escribe tu mensaje").fill("Quiero hacer Face swap");
  await chat.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(chat.getByText(/Te llevo a Face swap/)).toBeVisible();
  await chat.getByRole("button", { name: "Abrir Face swap" }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/face-swap$`));

  chat = await openAssistant();
  await chat.getByLabel("Escribe tu mensaje").fill("¿Dónde veo el resultado final?");
  await chat.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(chat.getByText(/revisar el resultado final/)).toBeVisible();
  await chat.getByRole("button", { name: "Abrir Resultados" }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/results$`));

  expect(receivedMessages).toHaveLength(2);
  expect(receivedMessages[0].message).toContain("Face swap");
  expect(receivedMessages[0].history.length).toBeGreaterThan(0);
  expect(receivedMessages[1].message).toContain("resultado final");
});
