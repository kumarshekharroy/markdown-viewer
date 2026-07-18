import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the example document in reading mode by default', async () => {
    render(<App />);

    expect(screen.getAllByText('Markdown Viewer')).not.toHaveLength(0);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Markdown Viewer Example/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^Open$/i })).toBeInTheDocument();
  });

  it('opens the search panel and reports matches', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Find in document/i }));
    await user.type(screen.getByPlaceholderText(/Search this document/i), 'Markdown');

    expect(screen.getByText(/^1 of \d+$/i)).toBeInTheDocument();
  });
});
