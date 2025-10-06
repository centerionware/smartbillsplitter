import React from 'react';
// FIX: Changed import for `screen`. In some test setups with module resolution issues, `screen` may not be correctly resolved from `@testing-library/react`. Importing it directly from `@testing-library/dom` is a workaround.
import { render, act } from '@testing-library/react';
import { screen } from '@testing-library/dom';
// FIX: Import `Mock` type from vitest to correctly type mocks and resolve the 'Cannot find namespace vi' error.
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import AppGate from '../../AppGate';
import { useAuth, AuthContextType } from '../../hooks/useAuth';

// Mocks
vi.mock('../../hooks/useAuth');
const mockedUseAuth = useAuth as Mock;

vi.mock('../../App.tsx', () => ({
  default: () => <div data-testid="app-component">App</div>,
}));
vi.mock('../../components/Paywall.tsx', () => ({
  default: () => <div data-testid="paywall-component">Paywall</div>,
}));
vi.mock('../../components/PrivacyConsent.tsx', () => ({
  default: ({ onAccept }: { onAccept: () => void }) => (
    <div data-testid="privacy-component">
      <button onClick={onAccept}>Accept Privacy</button>
    </div>
  ),
}));
vi.mock('../../services/api', () => ({
    getApiUrl: vi.fn().mockImplementation(async (path: string) => `http://localhost/api${path}`),
    fetchWithRetry: vi.fn(),
}));

describe('AppGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset window.location search params
    Object.defineProperty(window, 'location', {
        value: {
            ...window.location,
            search: ''
        },
        writable: true
    });
  });

  it('renders PrivacyConsent if consent has not been given', () => {
    mockedUseAuth.mockReturnValue({
      subscriptionStatus: null,
      isLoading: false,
    } as AuthContextType);

    render(<AppGate />);
    expect(screen.getByTestId('privacy-component')).toBeInTheDocument();
  });

  it('renders loading spinner while auth is loading', () => {
    localStorage.setItem('privacyConsentAccepted', 'true');
    mockedUseAuth.mockReturnValue({
      subscriptionStatus: null,
      isLoading: true,
    } as AuthContextType);

    render(<AppGate />);
    expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
  });

  it('renders Paywall if consent is given but subscriptionStatus is null', () => {
    localStorage.setItem('privacyConsentAccepted', 'true');
    mockedUseAuth.mockReturnValue({
      subscriptionStatus: null,
      isLoading: false,
    } as AuthContextType);

    render(<AppGate />);
    expect(screen.getByTestId('paywall-component')).toBeInTheDocument();
  });

  it('renders the App if subscriptionStatus is "free"', () => {
    localStorage.setItem('privacyConsentAccepted', 'true');
    mockedUseAuth.mockReturnValue({
      subscriptionStatus: 'free',
      isLoading: false,
    } as AuthContextType);

    render(<AppGate />);
    expect(screen.getByTestId('app-component')).toBeInTheDocument();
  });

  it('renders the App if subscriptionStatus is "subscribed"', () => {
    localStorage.setItem('privacyConsentAccepted', 'true');
    mockedUseAuth.mockReturnValue({
      subscriptionStatus: 'subscribed',
      isLoading: false,
    } as AuthContextType);

    render(<AppGate />);
    expect(screen.getByTestId('app-component')).toBeInTheDocument();
  });

  it('starts trial when privacy is accepted for the first time', async () => {
    const startTrialMock = vi.fn();
    mockedUseAuth.mockReturnValue({
      subscriptionStatus: null,
      isLoading: false,
      startTrial: startTrialMock,
    } as unknown as AuthContextType);

    render(<AppGate />);
    
    const acceptButton = screen.getByText('Accept Privacy');
    await act(async () => {
      acceptButton.click();
    });

    expect(startTrialMock).toHaveBeenCalled();
    expect(localStorage.getItem('privacyConsentAccepted')).toBe('true');
  });
});