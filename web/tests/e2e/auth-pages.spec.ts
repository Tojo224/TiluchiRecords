import { expect, test } from "@playwright/test";

test("mantiene coherencia visual en el flujo de autenticacion", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Iniciar sesion" }),
  ).toBeVisible();
  await expect(
    page.getByText("Estudio creativo audiovisual").last(),
  ).toBeVisible();
  await expect(page.getByLabel("Correo")).toBeVisible();
  await expect(page.getByLabel("Contrasena")).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "Mostrar clave" }).click();
  await expect(page.getByLabel("Contrasena")).toHaveAttribute("type", "text");
  await page.screenshot({
    path: "test-results/auth-login-light.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Usar tema oscuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "test-results/auth-login-dark.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel("Nombre completo")).toBeVisible();
  await page.screenshot({
    path: "test-results/auth-register-dark.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Iniciar sesion" }).click();
  await page.getByRole("link", { name: "Olvide mi contrasena" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Recuperar contrasena" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/auth-forgot-dark.png",
    fullPage: true,
  });

  await page.goto("/reset-password");
  await expect(page.getByLabel("Token de recuperacion")).toBeVisible();
  await expect(page.getByLabel("Nueva contrasena")).toBeVisible();
  await page.screenshot({
    path: "test-results/auth-reset-dark.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  await page.screenshot({
    path: "test-results/auth-login-mobile.png",
    fullPage: true,
  });
});
