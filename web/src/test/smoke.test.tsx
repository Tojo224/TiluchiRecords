import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("unit test runner", () => {
  it("renders a React element in jsdom", () => {
    render(<p>hello</p>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
