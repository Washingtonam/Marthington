// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({
    user: {
      _id: "u1",
      role: "owner",
      branch: "b1",
      permissions: { canMakeSale: true, canViewSales: true }
    },
    business: {
      name: "Northwind",
      subscription: { status: "active" }
    }
  })
}));

vi.mock("../api/client.js", () => ({
  default: vi.fn((path) => {
    if (path === "/products?limit=500") {
      return Promise.resolve([{ _id: "p1", name: "Laptop", category: "Tech", sellingPrice: 2500, stock: 10 }]);
    }
    if (path === "/sales") {
      return Promise.resolve({
        sale: {
          _id: "sale-1",
          receiptId: "RCP-100"
        }
      });
    }
    return Promise.resolve([]);
  })
}));

vi.mock("../api/services.js", () => ({
  getServices: vi.fn(async () => [])
}));

vi.mock("../api/branches.js", () => ({
  getBranches: vi.fn(async () => []),
  getBranchInventory: vi.fn(async () => [])
}));

vi.mock("../api/customers.js", () => ({
  getCustomers: vi.fn(async () => [])
}));

import POS from "../pages/POS.jsx";

describe("POS checkout", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("navigates to the receipt page with a print trigger after confirming the cart", async () => {
    render(<POS />);

    expect(await screen.findByText("Laptop")).toBeTruthy();
    fireEvent.click(screen.getByText("Laptop"));
    fireEvent.click(screen.getByRole("button", { name: /confirm & print/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/app/sales/sale-1",
        expect.objectContaining({
          state: expect.objectContaining({
            autoPrint: true,
            autoSend: false
          })
        })
      );
    });
  });
});
