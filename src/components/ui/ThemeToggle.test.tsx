import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useUiStore } from '@/stores/uiStore';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    // Reset theme to dark
    useUiStore.setState({ theme: 'dark' });
  });

  it('shows "Switch to light mode" aria-label in dark mode', () => {
    render(<ThemeToggle />);
    expect(screen.getByLabelText('Switch to light mode')).toBeInTheDocument();
  });

  it('shows "Switch to dark mode" aria-label in light mode', () => {
    useUiStore.setState({ theme: 'light' });
    render(<ThemeToggle />);
    expect(screen.getByLabelText('Switch to dark mode')).toBeInTheDocument();
  });

  it('renders SunIcon in dark mode (icon has aria-hidden)', () => {
    render(<ThemeToggle />);
    const button = screen.getByTestId('theme-toggle');
    const svg = button.querySelector('svg');
    // SunIcon has a circle element
    expect(svg?.querySelector('circle')).toBeTruthy();
  });

  it('renders MoonIcon in light mode (icon has path)', () => {
    useUiStore.setState({ theme: 'light' });
    render(<ThemeToggle />);
    const button = screen.getByTestId('theme-toggle');
    const svg = button.querySelector('svg');
    // MoonIcon has a path but no circle
    expect(svg?.querySelector('path')).toBeTruthy();
    expect(svg?.querySelector('circle')).toBeFalsy();
  });

  it('calls toggleTheme when clicked', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByTestId('theme-toggle'));

    expect(useUiStore.getState().theme).toBe('light');
  });

  it('toggles back to dark after two clicks', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByTestId('theme-toggle'));
    await user.click(screen.getByTestId('theme-toggle'));

    expect(useUiStore.getState().theme).toBe('dark');
  });
});
