import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useUiStore } from '@/stores/uiStore';
import { ConnectionStatus } from './ConnectionStatus';

// Mock WebSocketManager and UpbitWebSocketManager
const mockReconnect = vi.fn();
const mockUpbitReconnect = vi.fn();

vi.mock('@/lib/websocket/WebSocketManager', () => ({
  WebSocketManager: {
    getInstance: () => ({ reconnect: mockReconnect }),
  },
}));

vi.mock('@/lib/upbit/UpbitWebSocketManager', () => ({
  UpbitWebSocketManager: {
    getInstance: () => ({ reconnect: mockUpbitReconnect }),
  },
}));

describe('ConnectionStatus', () => {
  beforeEach(() => {
    useUiStore.setState({
      connectionState: { status: 'idle' },
      exchange: 'binance',
    });
    mockReconnect.mockClear();
    mockUpbitReconnect.mockClear();
  });

  it('shows "Idle" for idle state', () => {
    render(<ConnectionStatus />);
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('shows "Connected" for connected state', () => {
    useUiStore.setState({
      connectionState: { status: 'connected', connectedAt: Date.now() },
    });

    render(<ConnectionStatus />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows "Connecting..." for connecting state', () => {
    useUiStore.setState({
      connectionState: { status: 'connecting' },
    });

    render(<ConnectionStatus />);
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('shows "Reconnecting (N)..." with attempt number', () => {
    useUiStore.setState({
      connectionState: { status: 'reconnecting', attempt: 3 },
    });

    render(<ConnectionStatus />);
    expect(screen.getByText('Reconnecting (3)...')).toBeInTheDocument();
  });

  it('shows "Disconnected" for failed state', () => {
    useUiStore.setState({
      connectionState: { status: 'failed', error: 'Max retries' },
    });

    render(<ConnectionStatus />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('shows "REST Polling" for polling state', () => {
    useUiStore.setState({
      connectionState: { status: 'polling', startedAt: Date.now() },
    });

    render(<ConnectionStatus />);
    expect(screen.getByText('REST Polling')).toBeInTheDocument();
  });

  it('shows Reconnect button for failed state', () => {
    useUiStore.setState({
      connectionState: { status: 'failed', error: 'Error' },
    });

    render(<ConnectionStatus />);
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument();
  });

  it('shows Reconnect button for polling state', () => {
    useUiStore.setState({
      connectionState: { status: 'polling', startedAt: Date.now() },
    });

    render(<ConnectionStatus />);
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument();
  });

  it('does not show Reconnect button for connected state', () => {
    useUiStore.setState({
      connectionState: { status: 'connected', connectedAt: Date.now() },
    });

    render(<ConnectionStatus />);
    expect(screen.queryByRole('button', { name: 'Reconnect' })).not.toBeInTheDocument();
  });

  it('calls WebSocketManager.reconnect() on click (binance exchange)', async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      connectionState: { status: 'failed', error: 'Error' },
      exchange: 'binance',
    });

    render(<ConnectionStatus />);
    await user.click(screen.getByRole('button', { name: 'Reconnect' }));

    expect(mockReconnect).toHaveBeenCalledOnce();
    expect(mockUpbitReconnect).not.toHaveBeenCalled();
  });

  it('calls UpbitWebSocketManager.reconnect() on click (upbit exchange)', async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      connectionState: { status: 'failed', error: 'Error' },
      exchange: 'upbit',
    });

    render(<ConnectionStatus />);
    await user.click(screen.getByRole('button', { name: 'Reconnect' }));

    expect(mockUpbitReconnect).toHaveBeenCalledOnce();
    expect(mockReconnect).not.toHaveBeenCalled();
  });

  it('renders the pulse animation for connecting state', () => {
    useUiStore.setState({
      connectionState: { status: 'connecting' },
    });

    render(<ConnectionStatus />);
    const container = screen.getByTestId('connection-status');
    const pingSpan = container.querySelector('.animate-ping');
    expect(pingSpan).toBeTruthy();
  });

  it('does not render pulse animation for connected state', () => {
    useUiStore.setState({
      connectionState: { status: 'connected', connectedAt: Date.now() },
    });

    render(<ConnectionStatus />);
    const container = screen.getByTestId('connection-status');
    const pingSpan = container.querySelector('.animate-ping');
    expect(pingSpan).toBeFalsy();
  });
});
