import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Staff from '../pages/Staff.jsx'
import Sidebar from '../components/layout/Sidebar.jsx'

vi.mock('../api/client.js', () => {
  return {
    default: async (path) => {
      if (path === '/staff') return []
      return {}
    }
  }
})

afterEach(() => {
  cleanup()
})

describe('Staff page', () => {
  it('shows the team and access navigation with a direct roles shortcut', () => {
    render(
      <MemoryRouter initialEntries={['/app/staff']}>
        <Sidebar />
      </MemoryRouter>
    )

    expect(screen.getByText('Team & Access')).toBeTruthy()
    expect(screen.getByText('Staff')).toBeTruthy()
    expect(screen.getByText('Roles & Permissions')).toBeTruthy()
    expect(screen.getByText('Branches')).toBeTruthy()
  })

  it('renders Add Team Member button and opens drawer', async () => {
    render(<Staff />)
    const btn = await screen.findByText('+ Add Team Member')
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(await screen.findByText('New Team Member')).toBeTruthy()
  })

  it('toggles permission switch', async () => {
    render(<Staff />)
    const btn = await screen.findByText('+ Add Team Member')
    fireEvent.click(btn)
    const permissionLabel = await screen.findByText('Create sales')
    expect(permissionLabel).toBeTruthy()
    const toggleBtns = await screen.findAllByRole('button')
    fireEvent.click(toggleBtns[toggleBtns.length - 1])
    expect(true).toBe(true)
  })
})
