import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

// A component that throws on render when `shouldThrow` is true
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test explosion');
  }
  return <p>All good</p>;
}

describe('ErrorBoundary', () => {
  // Suppress React's default error boundary console.error logging during tests
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <p>Safe content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders ErrorFallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test explosion')).toBeInTheDocument();
  });

  it('passes widgetName to ErrorFallback', () => {
    render(
      <ErrorBoundary widgetName="Order Book">
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Order Book error')).toBeInTheDocument();
  });

  it('logs the error with component context', () => {
    render(
      <ErrorBoundary widgetName="Trades">
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ErrorBoundary] Trades crashed',
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Test explosion' }),
        timestamp: expect.any(Number),
      }),
    );
  });

  it('recovers when Retry is clicked', async () => {
    const user = userEvent.setup();

    // Use a stateful wrapper so we can control throwing behavior
    let shouldThrow = true;
    function ConditionalThrower() {
      if (shouldThrow) throw new Error('Boom');
      return <p>Recovered</p>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>,
    );

    // Should show fallback
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Fix the "error" and retry
    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('renders Retry button in the fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
