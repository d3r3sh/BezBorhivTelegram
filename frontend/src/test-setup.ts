import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Telegram WebApp SDK — not available in jsdom
vi.mock('@twa-dev/sdk', () => ({
  default: {
    initData: 'auth_date=1700000000&user=%7B%22id%22%3A123456789%7D&hash=testhash',
    ready: vi.fn(),
    BackButton: {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    },
    MainButton: {
      show: vi.fn(),
      hide: vi.fn(),
      setText: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    },
    showAlert: vi.fn(),
    showConfirm: vi.fn(),
    close: vi.fn(),
    themeParams: {},
  },
}))
