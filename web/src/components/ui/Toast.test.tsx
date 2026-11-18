import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

let api: ReturnType<typeof useToast>;
function Probe() {
  api = useToast();
  return null;
}

function mount() {
  return render(
    <ToastProvider>
      <Probe />
    </ToastProvider>,
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Toast", () => {
  it("uses a labelled polite region with status/alert cards", () => {
    mount();
    act(() => {
      api.toast.success("Hecho", "Titulo");
      api.toast.error("Fallo");
    });
    const region = screen.getByRole("region", { name: "Notificaciones" });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveTextContent("Titulo");
    expect(screen.getByRole("alert")).toHaveTextContent("Fallo");
  });

  it("auto-dismisses after its duration", () => {
    mount();
    act(() => {
      api.toast.info("Hola");
    });
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Hola")).toBeNull();
  });

  it("runs the action and dismisses the card", () => {
    mount();
    const onClick = vi.fn();
    act(() => {
      api.toast.custom({
        type: "info",
        message: "Hazlo",
        action: { label: "Mostrarme", onClick },
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Mostrarme" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Hazlo")).toBeNull();
  });

  it("pauses on hover and resumes with the remaining time", () => {
    mount();
    act(() => {
      api.toast.info("Pausa");
    });
    const card = screen.getByRole("status");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.mouseEnter(card);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Pausa")).toBeInTheDocument();
    fireEvent.mouseLeave(card);
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(screen.getByText("Pausa")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Pausa")).toBeNull();
  });

  it("pauses while focus is inside the card", () => {
    mount();
    act(() => {
      api.toast.custom({
        type: "info",
        message: "Foco",
        action: { label: "Ir", onClick: vi.fn() },
      });
    });
    const button = screen.getByRole("button", { name: "Ir" });
    fireEvent.focus(button);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Foco")).toBeInTheDocument();
    fireEvent.blur(button);
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Foco")).toBeNull();
  });

  it("clears its timers on unmount", () => {
    const view = mount();
    act(() => {
      api.toast.info("Adios");
    });
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns an id that can be dismissed", () => {
    mount();
    let id = "";
    act(() => {
      id = api.toast.info("Quitar");
    });
    act(() => api.dismiss(id));
    expect(screen.queryByText("Quitar")).toBeNull();
  });
});
