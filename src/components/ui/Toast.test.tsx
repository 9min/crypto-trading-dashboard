import { render, screen, fireEvent } from '@testing-library/react';
import { useToastStore, type Toast as ToastData } from '@/stores/toastStore';
import { Toast } from './Toast';

function makeToast(overrides: Partial<ToastData> = {}): ToastData {
  return {
    id: 'toast-1',
    message: 'Test notification',
    type: 'info',
    duration: 4000,
    ...overrides,
  };
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset toast store
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the toast message', () => {
    render(<Toast toast={makeToast({ message: 'Connection lost' })} />);
    expect(screen.getByText('Connection lost')).toBeInTheDocument();
  });

  it('has role="alert" for accessibility', () => {
    render(<Toast toast={makeToast()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders close button with aria-label', () => {
    render(<Toast toast={makeToast()} />);
    expect(screen.getByLabelText('Dismiss notification')).toBeInTheDocument();
  });

  it('calls removeToast when close button is clicked', () => {
    const toast = makeToast({ id: 'toast-close-test' });
    // Add the toast to the store so removeToast works
    useToastStore.setState({ toasts: [toast] });

    render(<Toast toast={toast} />);
    fireEvent.click(screen.getByLabelText('Dismiss notification'));

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('auto-dismisses after the configured duration', () => {
    const toast = makeToast({ id: 'auto-dismiss', duration: 3000 });
    useToastStore.setState({ toasts: [toast] });

    render(<Toast toast={toast} />);

    // Not yet removed
    expect(useToastStore.getState().toasts).toHaveLength(1);

    // Advance past the duration
    vi.advanceTimersByTime(3000);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('does not auto-dismiss when duration is 0', () => {
    const toast = makeToast({ id: 'no-dismiss', duration: 0 });
    useToastStore.setState({ toasts: [toast] });

    render(<Toast toast={toast} />);

    vi.advanceTimersByTime(10000);

    // Should still be present
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('does not auto-dismiss when duration is negative', () => {
    const toast = makeToast({ id: 'neg-dismiss', duration: -1 });
    useToastStore.setState({ toasts: [toast] });

    render(<Toast toast={toast} />);

    vi.advanceTimersByTime(10000);

    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  describe('type-specific rendering', () => {
    it.each(['info', 'success', 'warning', 'error'] as const)(
      'renders %s toast without error',
      (type) => {
        render(<Toast toast={makeToast({ type })} />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
    );
  });
});
