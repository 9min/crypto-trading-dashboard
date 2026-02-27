import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WidgetWrapper } from './WidgetWrapper';

describe('WidgetWrapper', () => {
  it('renders the title', () => {
    render(
      <WidgetWrapper title="Order Book">
        <div>Content</div>
      </WidgetWrapper>,
    );
    expect(screen.getByTestId('widget-title')).toHaveTextContent('Order Book');
  });

  it('renders children content', () => {
    render(
      <WidgetWrapper title="Test">
        <p>Widget body</p>
      </WidgetWrapper>,
    );
    expect(screen.getByText('Widget body')).toBeInTheDocument();
  });

  it('renders headerActions slot', () => {
    render(
      <WidgetWrapper title="Test" headerActions={<button type="button">Action</button>}>
        <div>Content</div>
      </WidgetWrapper>,
    );
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('renders close button when onClose is provided', () => {
    render(
      <WidgetWrapper title="Chart" onClose={() => {}}>
        <div>Content</div>
      </WidgetWrapper>,
    );
    expect(screen.getByRole('button', { name: 'Hide Chart' })).toBeInTheDocument();
  });

  it('does not render close button when onClose is not provided', () => {
    render(
      <WidgetWrapper title="Chart">
        <div>Content</div>
      </WidgetWrapper>,
    );
    expect(screen.queryByRole('button', { name: 'Hide Chart' })).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <WidgetWrapper title="Trades" onClose={handleClose}>
        <div>Content</div>
      </WidgetWrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'Hide Trades' }));
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it('has correct aria-label on the close button', () => {
    render(
      <WidgetWrapper title="Watchlist" onClose={() => {}}>
        <div>Content</div>
      </WidgetWrapper>,
    );
    const closeBtn = screen.getByRole('button', { name: 'Hide Watchlist' });
    expect(closeBtn).toHaveAttribute('aria-label', 'Hide Watchlist');
  });
});
