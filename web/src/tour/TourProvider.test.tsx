import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Project } from "@/shared/types/domain";
import { TourProvider } from "./TourProvider";
import { tourStorageKey } from "./storage";
import { useTour, type TourContextValue } from "./useTour";

const auth = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
}));
const projectsState = vi.hoisted(() => ({
  value: {
    projects: [] as unknown[],
    loading: false,
    error: "",
    refresh: vi.fn(async (): Promise<Project[] | undefined> => undefined),
  },
}));
const run = vi.hoisted(() => vi.fn());

vi.mock("@/app/providers/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("../app/providers/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("../features/projects/hooks/useProjects", () => ({
  useProjects: () => projectsState.value,
}));
vi.mock("./tourRunner", () => ({ runMicroTour: run }));

let tour: TourContextValue;
let navigateTo: (path: string) => void;
function Probe() {
  tour = useTour();
  navigateTo = useNavigate();
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function project(id: string): Project {
  return {
    id,
    name: id,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
  };
}

/** Cards currently shown in the toast viewport. */
function toastCards() {
  const region = screen.getByRole("region", { name: "Notificaciones" });
  return [
    ...within(region).queryAllByRole("status"),
    ...within(region).queryAllByRole("alert"),
  ];
}

function setProjects(projects: Project[], loading = false) {
  projectsState.value = { ...projectsState.value, projects, loading };
}

function tree(path = "/dashboard") {
  return (
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <TourProvider>
          <Probe />
        </TourProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  auth.user = { id: "u1" };
  setProjects([]);
  vi.mocked(projectsState.value.refresh).mockReset();
  run.mockReset();
  run.mockReturnValue(vi.fn());
});

afterEach(() => vi.restoreAllMocks());

describe("TourProvider", () => {
  it("records existing work silently on the first evaluation", () => {
    setProjects([project("p1")]);
    render(tree());
    expect(tour.progress?.completed).toContain("create-project");
    expect(toastCards()).toHaveLength(0);
  });

  it("toasts a completed mission and offers the next step", () => {
    const { rerender } = render(tree());
    expect(toastCards()).toHaveLength(0);
    setProjects([project("p1")]);
    rerender(tree());
    expect(tour.progress?.completed).toEqual(["create-project"]);
    expect(toastCards()).toHaveLength(2);
    const [done, next] = toastCards();
    expect(done).toHaveTextContent("Paso completado");
    expect(done).toHaveTextContent("Listo, ya tienes un proyecto.");
    expect(next).toHaveTextContent("Siguiente paso: Sube un video");
    expect(next).toHaveTextContent(/Subir video/);
    fireEvent.click(within(next).getByRole("button", { name: "Mostrarme" }));
    expect(run.mock.calls[0][0][0].target).toBe("karaoke-upload");
  });

  it("replaces earlier tour toasts instead of stacking them", () => {
    const { rerender } = render(tree("/projects/p1"));
    act(() => tour.reportProject({ projectId: "p1", snapshot: {} }));
    setProjects([project("p1")]);
    rerender(tree("/projects/p1"));
    act(() =>
      tour.reportProject({ projectId: "p1", snapshot: { videoCount: 1 } }),
    );
    expect(toastCards()).toHaveLength(2);
    act(() =>
      tour.reportProject({
        projectId: "p1",
        snapshot: { videoCount: 1, karaokeReady: true },
      }),
    );
    expect(toastCards()).toHaveLength(2);
    expect(screen.getAllByText("Paso completado")).toHaveLength(1);
  });

  it("stays silent once the guide was dismissed", () => {
    const { rerender } = render(tree());
    act(() => tour.dismiss());
    setProjects([project("p1")]);
    rerender(tree());
    expect(tour.progress?.completed).toEqual(["create-project"]);
    expect(toastCards()).toHaveLength(0);
  });

  it("does nothing until the user and the projects are loaded", () => {
    setProjects([project("p1")], true);
    const { rerender } = render(tree());
    expect(tour.showWelcome).toBe(false);
    expect(tour.progress?.completed).toEqual([]);
    auth.user = null;
    rerender(tree());
    expect(tour.progress).toBeNull();
  });

  it("shows the welcome once", () => {
    const first = render(tree());
    expect(tour.showWelcome).toBe(true);
    act(() => tour.completeWelcome());
    expect(tour.showWelcome).toBe(false);
    first.unmount();
    render(tree());
    expect(tour.showWelcome).toBe(false);
  });

  it("persists dismiss and restart resets it", () => {
    const first = render(tree());
    act(() => tour.dismiss());
    expect(
      JSON.parse(localStorage.getItem(tourStorageKey("u1")) ?? "{}"),
    ).toMatchObject({ dismissed: true });
    first.unmount();
    render(tree());
    expect(tour.progress?.dismissed).toBe(true);
    act(() => tour.restart());
    expect(tour.progress).toMatchObject({ dismissed: false, welcomed: false });
    expect(localStorage.getItem(tourStorageKey("u1"))).toBeNull();
  });

  it("survives a failing localStorage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(tree());
    act(() => tour.dismiss());
    expect(tour.progress?.dismissed).toBe(true);
  });

  it("navigates to the mission route and runs its micro-tour", () => {
    setProjects([project("p1")]);
    render(tree());
    act(() => tour.startMission("upload-video"));
    expect(screen.getByTestId("path")).toHaveTextContent(
      "/projects/p1/karaoke",
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0][0].target).toBe("karaoke-upload");
    expect(tour.activeMissionId).toBe("upload-video");
  });

  it("asks for a project first when a project mission has none", async () => {
    render(tree());
    await act(async () => tour.startMission("upload-video"));
    expect(screen.getByTestId("path")).toHaveTextContent("/projects");
    expect(run.mock.calls[0][0][0].target).toBe("new-project");
    expect(toastCards()[0]).toHaveTextContent(/Primero crea un proyecto/);
  });

  it("uses the last seen project when the list is stale", async () => {
    render(tree("/projects/p9"));
    act(() => tour.reportProject({ projectId: "p9", snapshot: {} }));
    act(() => navigateTo("/dashboard"));
    await act(async () => tour.startMission("upload-video"));
    expect(screen.getByTestId("path")).toHaveTextContent(
      "/projects/p9/karaoke",
    );
    expect(screen.queryByText(/Primero crea un proyecto/)).toBeNull();
    expect(projectsState.value.refresh).not.toHaveBeenCalled();
  });

  it("refreshes the list once before saying there is no project", async () => {
    vi.mocked(projectsState.value.refresh).mockResolvedValueOnce([
      project("p7"),
    ]);
    render(tree());
    await act(async () => tour.startMission("upload-video"));
    expect(projectsState.value.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("path")).toHaveTextContent(
      "/projects/p7/karaoke",
    );
  });

  it("still asks to create a project when there truly is none", async () => {
    render(tree());
    await act(async () => tour.startMission("sing-karaoke"));
    expect(projectsState.value.refresh).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Primero crea un proyecto para continuar."),
    ).toBeInTheDocument();
  });

  it("forgets the last seen project when the user changes", async () => {
    const { rerender } = render(tree("/projects/p9"));
    act(() => tour.reportProject({ projectId: "p9", snapshot: {} }));
    act(() => navigateTo("/dashboard"));
    auth.user = { id: "u2" };
    rerender(tree("/dashboard"));
    await act(async () => tour.startMission("upload-video"));
    expect(screen.getByTestId("path")).not.toHaveTextContent("p9");
  });

  it("tells the user when the tour has nothing to show", () => {
    setProjects([project("p1")]);
    render(tree());
    act(() => {
      void tour.startMission("sing-karaoke");
    });
    expect(run.mock.calls[0][1].waitMs).toBe(5000);
    act(() => run.mock.calls[0][1].onUnavailable());
    expect(toastCards()).toHaveLength(1);
    expect(toastCards()[0]).toHaveTextContent(
      /Todavia no podemos mostrar este paso.*usa Crear karaoke/,
    );
  });

  it("uses only the generic notice when the mission has no hint", () => {
    setProjects([project("p1")]);
    render(tree());
    act(() => tour.startMission("upload-video"));
    act(() => run.mock.calls[0][1].onUnavailable());
    expect(toastCards()).toHaveLength(1);
    expect(toastCards()[0]).not.toHaveTextContent("Crear karaoke");
  });

  it("toasts create-project when a first-time user lands on the new project", () => {
    const { rerender } = render(tree("/projects"));
    expect(toastCards()).toHaveLength(0);
    setProjects([project("p1")]);
    act(() => navigateTo("/projects/p1"));
    rerender(tree("/projects"));
    act(() => tour.reportProject({ projectId: "p1", snapshot: {} }));
    expect(tour.progress?.completed).toEqual(["create-project"]);
    expect(toastCards()).toHaveLength(2);
    expect(
      screen.getByText("Listo, ya tienes un proyecto."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Siguiente paso: Sube un video"),
    ).toBeInTheDocument();
  });

  it("stays silent for finished work in a project opened for the first time", () => {
    setProjects([project("p1")]);
    const { rerender } = render(tree("/dashboard"));
    act(() => navigateTo("/projects/p1"));
    rerender(tree("/dashboard"));
    act(() =>
      tour.reportProject({
        projectId: "p1",
        snapshot: { videoCount: 1, karaokeReady: true },
      }),
    );
    expect(tour.progress?.completed).toEqual([
      "create-project",
      "upload-video",
      "create-karaoke",
    ]);
    expect(toastCards()).toHaveLength(0);
  });

  it("clears tour toasts and the active tour when the user changes", async () => {
    const dispose = vi.fn();
    run.mockReturnValueOnce(dispose);
    const { rerender } = render(tree());
    await act(async () => tour.startMission("upload-video"));
    expect(toastCards()).toHaveLength(1);
    expect(tour.activeMissionId).toBe("create-project");
    auth.user = { id: "u2" };
    rerender(tree());
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(toastCards()).toHaveLength(0);
    expect(tour.activeMissionId).toBeNull();
  });

  it("ends the tour when leaving its page", () => {
    const dispose = vi.fn();
    run.mockReturnValueOnce(dispose);
    setProjects([project("p1")]);
    render(tree());
    act(() => tour.startMission("upload-video"));
    expect(tour.activeMissionId).toBe("upload-video");
    act(() => navigateTo("/dashboard"));
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(tour.activeMissionId).toBeNull();
  });

  it("runs one tour at a time and disposes it on unmount", () => {
    const disposeFirst = vi.fn();
    const disposeSecond = vi.fn();
    run.mockReturnValueOnce(disposeFirst).mockReturnValueOnce(disposeSecond);
    setProjects([project("p1")]);
    const view = render(tree());
    act(() => tour.startMission("upload-video"));
    act(() => tour.startMission("create-karaoke"));
    expect(disposeFirst).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(disposeSecond).toHaveBeenCalledTimes(1);
  });
});
