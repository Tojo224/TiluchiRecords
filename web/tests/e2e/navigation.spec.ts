import { expect, test } from "@playwright/test";

test("navega por pantallas, sidebar y temas", async ({ page, request }) => {
  const email = "frontend-e2e@example.com";
  const password = "Prueba123!";
  const registration = await request.post(
    "http://localhost:3000/api/v1/auth/register",
    { data: { name: "Prueba Frontend", email, password } },
  );
  expect([201, 409]).toContain(registration.status());

  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contrasena").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("navigation")).toContainText("Inicio");
  await expect(page.getByRole("navigation")).toContainText("Proyectos");
  await expect(page.getByRole("navigation")).toContainText("Mi perfil");
  await expect(page.getByRole("navigation")).not.toContainText("Seguridad");
  await expect(page.getByRole("heading", { name: /Hola/ })).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-light.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Usar tema oscuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "test-results/dashboard-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/dashboard-mobile-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole("link", { name: "Mi perfil" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByRole("heading", { name: "Datos personales" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Seguridad de la cuenta" }),
  ).toBeVisible();
  await page.getByLabel("Telefono").fill("+591 70000000");
  await page.getByRole("button", { name: "Guardar datos" }).click();
  await expect(page.getByText("Datos personales actualizados.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Telefono")).toHaveValue("+591 70000000");
  await page.getByLabel("Contrasena actual").fill(password);
  await page
    .getByLabel("Nueva contrasena", { exact: true })
    .fill("NuevaPrueba123!");
  await page
    .getByLabel("Confirmar nueva contrasena")
    .fill("ConfirmacionDistinta123!");
  await page.getByRole("button", { name: "Cambiar contrasena" }).click();
  await expect(
    page.getByText("La nueva contrasena y su confirmacion no coinciden."),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/profile-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Usar tema claro" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "test-results/profile-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Usar tema oscuro" }).click();
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/profile-mobile-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/security");
  await expect(page).toHaveURL(/\/profile$/);

  await page.getByRole("link", { name: "Proyectos", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("navigation")).not.toContainText(
    "Nuevo proyecto",
  );
  await page.getByRole("button", { name: "Nuevo proyecto" }).click();
  await expect(
    page.getByRole("dialog", { name: "Nuevo proyecto" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Nuevo proyecto" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Nuevo proyecto" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.screenshot({
    path: "test-results/new-project-modal-dark.png",
    fullPage: true,
  });
  const projectCoverInput = page.getByLabel("Foto de portada");
  await projectCoverInput.setInputFiles({
    name: "portada-proyecto.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByRole("img", { name: "Vista previa de la portada" }),
  ).toBeVisible();
  await page.getByLabel("Nombre").fill("Proyecto E2E");
  await page
    .getByLabel("Descripcion")
    .fill("Validacion de rutas y componentes");
  await page.getByRole("button", { name: "Crear proyecto" }).click();

  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await expect(
    page.getByRole("img", { name: "Portada de Proyecto E2E" }),
  ).toBeVisible();
  await expect(page.getByText("Archivos cargados")).toBeVisible();
  await expect(page.getByText("Archivos generados")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Procesos");
  await page.screenshot({
    path: "test-results/project-overview-dark.png",
    fullPage: true,
  });
  const sidebar = page.locator("aside");
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(100);
  expect((await sidebar.boundingBox())?.y).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Usar tema claro" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "test-results/project-overview-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Usar tema oscuro" }).click();
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/project-overview-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("navigation")).toContainText("Karaoke");
  await expect(page.getByRole("navigation")).toContainText("Face swap");
  await expect(page.getByRole("navigation")).toContainText(
    "Video desde musica",
  );
  await expect(page.getByRole("navigation")).not.toContainText("Procesos");
  const projectOverviewUrl = page.url();
  await page.goto(`${projectOverviewUrl}/jobs`);
  await expect(page).toHaveURL(projectOverviewUrl);

  await page.getByRole("link", { name: "Archivos" }).first().click();
  await expect(page).toHaveURL(/\/files$/);
  await expect(
    page.getByRole("heading", { name: "Archivos cargados" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Archivos generados" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Subir musica" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Subir video" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Subir rostro" }),
  ).toBeVisible();
  const sourceInputs = page.locator('input[type="file"]');
  await expect(sourceInputs).toHaveCount(3);
  await expect(sourceInputs.nth(0)).toHaveAttribute(
    "accept",
    /video\/mp4.*video\/mpeg/,
  );
  await sourceInputs.nth(0).setInputFiles({
    name: "music-container.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("e2e music container"),
  });
  await expect(page.getByText("Musica subido correctamente.")).toBeVisible();
  await expect(page.getByText("music-container.mp4")).toBeVisible();
  await sourceInputs.nth(0).setInputFiles({
    name: "second-song.mpeg",
    mimeType: "video/mpeg",
    buffer: Buffer.from("second e2e music container"),
  });
  await expect(page.getByText("second-song.mpeg")).toBeVisible();
  await expect(page.getByText("2 archivos", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/files-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Usar tema claro" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "test-results/files-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Usar tema oscuro" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("link", { name: "Resultados" }).first().click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(
    page.getByRole("heading", { name: "Videos karaoke" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Resultados de face swap" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Videoclips finales" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Pista vocal");
  await expect(page.getByRole("main")).not.toContainText("Pista instrumental");
  await expect(page.getByRole("main")).not.toContainText("Clip generado");
  await page.screenshot({
    path: "test-results/results-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Usar tema claro" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "test-results/results-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Usar tema oscuro" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("link", { name: "Archivos" }).first().click();

  await page.getByRole("link", { name: "Karaoke" }).first().click();
  await expect(page).toHaveURL(/\/karaoke$/);
  await expect(
    page.getByRole("heading", { name: "Karaoke", exact: true }),
  ).toBeVisible();
  const karaokeVideoSelect = page.getByLabel("Video del proyecto");
  await expect(karaokeVideoSelect.locator("option")).toHaveText([
    "No hay videos disponibles",
  ]);
  await page.locator('input[type="file"]').setInputFiles({
    name: "karaoke-source.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("e2e karaoke video"),
  });
  await expect(page.getByText("Video subido correctamente.")).toBeVisible();
  await expect(karaokeVideoSelect.locator("option")).toHaveText([
    "karaoke-source.mp4",
  ]);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar" }).first().click();
  const downloadedVideo = await downloadEvent;
  expect(downloadedVideo.suggestedFilename()).toBe("karaoke-source.mp4");
  await page.screenshot({
    path: "test-results/karaoke-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Usar tema claro" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "test-results/karaoke-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Usar tema oscuro" }).click();
  await page.waitForTimeout(300);
  await expect(
    page.getByRole("button", { name: "Crear karaoke" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generar mezcla final" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/karaoke-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole("link", { name: "Face swap" }).first().click();
  await expect(page).toHaveURL(/\/face-swap$/);
  await expect(page.getByRole("heading", { name: "Face swap" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Personas a reemplazar" }),
  ).toBeVisible();
  await expect(page.getByText("Indice del rostro objetivo")).toHaveCount(0);
  await page
    .locator('input[type="file"]')
    .nth(0)
    .setInputFiles({
      name: "rostro-fuente.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(page.getByText("Imagen subida correctamente.")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Vista previa de rostro-fuente.png" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/face-swap-source-preview-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Usar tema claro" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "test-results/face-swap-source-preview-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Usar tema oscuro" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("link", { name: "Video desde musica" }).first().click();
  await expect(page).toHaveURL(/\/music-video$/);
  await expect(
    page.getByRole("heading", { name: "Video desde musica" }),
  ).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveAttribute(
    "accept",
    /video\/mp4.*video\/mpeg.*\.mp4.*\.mpeg/,
  );
  const musicSelect = page.getByLabel("Musica del proyecto");
  await expect(musicSelect.locator("option")).toHaveCount(2);
  await musicSelect.selectOption({ label: "music-container.mp4" });
  const selectedAudioId = await musicSelect.inputValue();
  const analyzeRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/v1/jobs") && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Analizar y crear plan" }).click();
  expect((await analyzeRequest).postDataJSON()).toMatchObject({
    type: "ANALYZE_AUDIO",
    payload: { audioAssetId: selectedAudioId },
  });
  await page.screenshot({
    path: "test-results/music-video-dark.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-sidebar.png",
    fullPage: true,
  });

  const projectId = new URL(page.url()).pathname.split("/")[2];
  const token = await page.evaluate(() =>
    localStorage.getItem("tiluchi_token"),
  );
  const cleanup = await request.delete(
    `http://localhost:3000/api/v1/projects/${projectId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(cleanup.ok()).toBeTruthy();
});
