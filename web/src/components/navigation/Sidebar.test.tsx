import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

vi.mock("../../app/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Ana", email: "ana@example.com" },
    logout: vi.fn(),
  }),
}));

describe("Sidebar", () => {
  it("renders the help link inside the single navigation landmark", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );
    const navigations = screen.getAllByRole("navigation");
    expect(navigations).toHaveLength(1);
    const help = within(navigations[0]).getByRole("link", { name: "Ayuda" });
    expect(help).toHaveAttribute("href", "/help");
  });

  it("keeps profile and projects links unique and omits Seguridad", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("link", { name: "Mi perfil" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Proyectos" })).toHaveLength(1);
    expect(screen.getByRole("navigation")).not.toHaveTextContent("Seguridad");
  });
});
