import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Customers from '../pages/Customers.jsx';

vi.mock('../api/customers.js', () => ({
  getCustomers: vi.fn(async () => [
    {
      _id: 'cust-1',
      name: 'Ava Stone',
      phone: '555-0100',
      email: 'ava@example.com',
      address: '123 Main St',
      totalSpent: 120000,
      totalOrders: 2,
      status: 'active',
      outstandingBalance: 25000,
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ]),
}));

describe('Customers page', () => {
  it('opens the add customer drawer', async () => {
    render(<Customers />);

    fireEvent.click(await screen.findByRole('button', { name: /add customer/i }));

    expect(await screen.findByText('New Customer')).toBeTruthy();
  });
});
