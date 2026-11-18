import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MISSIONS } from "@/tour/missions";
import { EMPTY_TOUR_SNAPSHOT } from "@/tour/snapshot";
import { DEFAULT_TOUR_PROGRESS } from "@/tour/storage";
import { TourContext, type TourContextValue } from "@/tour/useTour";
import { MissionChecklist } from "./MissionChecklist";
import { TourNotices } from "./TourNotices";
import { TourWelcome } from "./TourWelcome";

function makeValue(
  overrides: Partial<TourContextValue> = {},
): TourContextValue {
  const completed = ["create-project"];
  return {
    progress: { ...DEFAULT_TOUR_PROGRESS, completed },
    snapshot: EMPTY_TOUR_SNAPSHOT,
    missions: MISSIONS.map((mission) => ({
      ...mission,
      done: completed.includes(mission.id),
    })),
    nextMission: MISSIONS[1],
    percent: 17,
    activeMissionId: null,
    showWelcome: false,
    notices: [],
    startMission: vi.fn(),
    completeWelcome: vi.fn(),
    dismiss: vi.fn(),
    reopen: vi.fn(),
    restart: vi.fn(),
    dismissNotice: vi.fn(),
    reportProject: vi.fn(),
    ...overrides,
  };
}

function withTour(value: TourContextValue, children: React.ReactNode) {
  return (
    <MemoryRouter>
      <TourContext.Provider value={value}>{children}</TourContext.Provider>
    </MemoryRouter>
  );
}

afterEach(() => vi.useRealTimers());

describe("MissionChecklist", () => {
  it("toggles the panel with aria-expanded and shows progress", () => {
    render(withTour(makeValue(), <MissionChecklist />));
    const toggle = screen.getByRole("button", { name: /^Guia/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("progressbar")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "17",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(MISSIONS.length);
    fireEvent.keyDown(toggle, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("links to the help manual from the open panel", () => {
    render(withTour(makeValue(), <MissionChecklist />));
    fireEvent.click(screen.getByRole("button", { name: /^Guia/ }));
    expect(
      screen.getByRole("link", { name: "Ver manual de ayuda" }),
    ).toHaveAttribute("href", "/help");
  });

  it("starts a mission, closes the panel and can hide the guide", () => {
    const value = makeValue();
    render(withTour(value, <MissionChecklist />));
    fireEvent.click(screen.getByRole("button", { name: /^Guia/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Empezar: Sube un video" }),
    );
    expect(value.startMission).toHaveBeenCalledWith("upload-video");
    expect(screen.queryByRole("progressbar")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Guia/ }));
    expect(
      screen.getByRole("button", { name: "Ir a: Crea tu primer proyecto" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar guia" }));
    expect(value.dismiss).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while loading, dismissed or touring", () => {
    const hidden = [
      makeValue({ progress: null }),
      makeValue({ progress: { ...DEFAULT_TOUR_PROGRESS, dismissed: true } }),
      makeValue({ activeMissionId: "upload-video" }),
    ];
    for (const value of hidden) {
      const view = render(withTour(value, <MissionChecklist />));
      expect(view.container).toBeEmptyDOMElement();
      view.unmount();
    }
  });
});

describe("TourWelcome", () => {
  it("renders nothing unless it should show", () => {
    const view = render(withTour(makeValue(), <TourWelcome />));
    expect(view.container).toBeEmptyDOMElement();
  });

  it("starts the next mission or closes without starting", () => {
    const value = makeValue({ showWelcome: true });
    render(withTour(value, <TourWelcome />));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Empezar guia" }));
    expect(value.completeWelcome).toHaveBeenCalledTimes(1);
    expect(value.startMission).toHaveBeenCalledWith("upload-video");
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(value.completeWelcome).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(screen.getByRole("region"), { key: "Escape" });
    expect(value.completeWelcome).toHaveBeenCalledTimes(3);
    expect(value.startMission).toHaveBeenCalledTimes(1);
  });
});

describe("TourNotices", () => {
  it("keeps a polite live region and auto-hides notices", () => {
    vi.useFakeTimers();
    const value = makeValue({
      notices: [{ id: 7, tone: "success", message: "Video subido." }],
    });
    render(withTour(value, <TourNotices />));
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Video subido.")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(value.dismissNotice).toHaveBeenCalledWith(7);
  });
});
