import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorFallback } from './ErrorFallback';

describe('ErrorFallback', () => {
  it('displays generic message when widgetName is not provided', () => {
    render(<ErrorFallback />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays widget-specific message when widgetName is provided', () => {
    render(<ErrorFallback widgetName="Order Book" />);
    expect(screen.getByText('Order Book error')).toBeInTheDocument();
  });

  it('displays the error message when error is provided', () => {
    render(<ErrorFallback error={new Error('Connection lost')} />);
    expect(screen.getByText('Connection lost')).toBeInTheDocument();
  });

  it('does not display error message when error is not provided', () => {
    const { container } = render(<ErrorFallback />);
    // Only the main message paragraph should exist
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(1);
  });

  it('renders Retry button when onRetry is provided', () => {
    render(<ErrorFallback onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('does not render Retry button when onRetry is not provided', () => {
    render(<ErrorFallback />);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('calls onRetry when Retry button is clicked', async () => {
    const user = userEvent.setup();
    const handleRetry = vi.fn();
    render(<ErrorFallback onRetry={handleRetry} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(handleRetry).toHaveBeenCalledOnce();
  });

  it('displays both widgetName and error together', () => {
    render(<ErrorFallback widgetName="Trades" error={new Error('Timeout')} />);
    expect(screen.getByText('Trades error')).toBeInTheDocument();
    expect(screen.getByText('Timeout')).toBeInTheDocument();
  });
});
