import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DisabledReason } from "./DisabledReason";

describe("DisabledReason", () => {
  it("lists the missing requirements in a status region", () => {
    render(<DisabledReason id="r" reasons={["un video", "consentimiento"]} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Falta: un video · consentimiento",
    );
  });

  it("keeps an empty, screen-reader-only live region when nothing is missing", () => {
    const { rerender } = render(
      <DisabledReason id="r" reasons={[]} className="mt-3" />,
    );
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    expect(region).toHaveClass("sr-only");
    expect(region).not.toHaveClass("mt-3");
    rerender(<DisabledReason id="r" reasons={["un video"]} className="mt-3" />);
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Falta: un video");
    expect(region).toHaveClass("mt-3");
  });
});
