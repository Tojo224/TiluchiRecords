import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HELP_SECTIONS } from "../content/help-content";
import { HelpPage } from "./HelpPage";

const tour = vi.hoisted(() => ({
  startMission: vi.fn(),
  restart: vi.fn(),
  reopen: vi.fn(),
}));

vi.mock("@/tour/useTour", () => ({ useTour: () => tour }));
vi.mock("../../../tour/useTour", () => ({ useTour: () => tour }));

describe("HelpPage", () => {
  it("renders a heading for every section", () => {
    render(<HelpPage />);
    HELP_SECTIONS.forEach((section) => {
      expect(
        screen.getByRole("heading", { level: 2, name: section.title }),
      ).toBeInTheDocument();
    });
  });

  it("indexes every section with a working in-page anchor, not a nav", () => {
    render(<HelpPage />);
    expect(screen.queryByRole("navigation")).toBeNull();
    const index = screen.getByRole("region", { name: "Indice de ayuda" });
    const links = within(index).getAllByRole("link");
    expect(links).toHaveLength(HELP_SECTIONS.length);
    links.forEach((link) => {
      const id = link.getAttribute("href")?.slice(1) ?? "";
      expect(document.getElementById(id)).not.toBeNull();
    });
  });

  it("labels each section by its heading", () => {
    render(<HelpPage />);
    HELP_SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id);
      expect(element?.tagName).toBe("SECTION");
      const labelId = element?.getAttribute("aria-labelledby") ?? "";
      expect(document.getElementById(labelId)).toHaveTextContent(section.title);
    });
  });

  it("starts the matching mission from a section button", () => {
    render(<HelpPage />);
    const withMission = HELP_SECTIONS.filter((section) => section.missionId);
    const buttons = screen.getAllByRole("button", {
      name: /^Empezar tutorial interactivo/,
    });
    expect(buttons).toHaveLength(withMission.length);
    fireEvent.click(buttons[0]);
    expect(tour.startMission).toHaveBeenCalledWith(withMission[0].missionId);
  });

  it("restarts the tutorial and reopens the checklist", () => {
    render(<HelpPage />);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tutorial" }));
    expect(tour.restart).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Mostrar guia de inicio" }),
    );
    expect(tour.reopen).toHaveBeenCalledTimes(1);
  });

  it("uses native details for troubleshooting", () => {
    const { container } = render(<HelpPage />);
    const total = HELP_SECTIONS.reduce(
      (count, section) => count + (section.troubleshooting?.length ?? 0),
      0,
    );
    expect(container.querySelectorAll("details")).toHaveLength(total);
  });
});
