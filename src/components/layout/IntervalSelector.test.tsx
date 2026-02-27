import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KLINE_INTERVALS } from '@/types/chart';
import { useKlineStore } from '@/stores/klineStore';
import { IntervalSelector } from './IntervalSelector';

describe('IntervalSelector', () => {
  beforeEach(() => {
    useKlineStore.getState().reset();
  });

  it('renders a button for each kline interval', () => {
    render(<IntervalSelector />);

    for (const interval of KLINE_INTERVALS) {
      expect(screen.getByTestId(`interval-${interval}`)).toBeInTheDocument();
    }
  });

  it('renders the correct number of buttons', () => {
    render(<IntervalSelector />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(KLINE_INTERVALS.length);
  });

  it('marks the active interval with aria-pressed="true"', () => {
    render(<IntervalSelector />);

    const defaultInterval = useKlineStore.getState().interval;
    const activeButton = screen.getByTestId(`interval-${defaultInterval}`);
    expect(activeButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks inactive intervals with aria-pressed="false"', () => {
    render(<IntervalSelector />);

    const defaultInterval = useKlineStore.getState().interval;
    for (const interval of KLINE_INTERVALS) {
      if (interval !== defaultInterval) {
        const button = screen.getByTestId(`interval-${interval}`);
        expect(button).toHaveAttribute('aria-pressed', 'false');
      }
    }
  });

  it('calls klineStore.setInterval when a button is clicked', async () => {
    const user = userEvent.setup();
    render(<IntervalSelector />);

    await user.click(screen.getByTestId('interval-5m'));

    expect(useKlineStore.getState().interval).toBe('5m');
  });

  it('updates aria-pressed when interval changes', async () => {
    const user = userEvent.setup();
    render(<IntervalSelector />);

    await user.click(screen.getByTestId('interval-1h'));

    expect(screen.getByTestId('interval-1h')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('interval-1m')).toHaveAttribute('aria-pressed', 'false');
  });

  it('displays the interval value as button text', () => {
    render(<IntervalSelector />);

    for (const interval of KLINE_INTERVALS) {
      expect(screen.getByTestId(`interval-${interval}`)).toHaveTextContent(interval);
    }
  });
});
