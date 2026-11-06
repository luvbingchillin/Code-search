import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectRepoModal } from '../components/repo/ConnectRepoModal';
import { RepositoryItem } from '../types';

describe('Codebase Repository Hub (ConnectRepoModal)', () => {
  const sampleRepos: RepositoryItem[] = [
    {
      id: 'requests',
      name: 'psf/requests',
      path: 'fixtures/requests',
      chunksCount: 284,
      filesCount: 17,
      status: 'indexed',
      description: 'Python HTTP for Humans',
    },
    {
      id: 'sample_codebase',
      name: 'sample_codebase',
      path: 'backend/sample_codebase',
      chunksCount: 14,
      filesCount: 3,
      status: 'indexed',
      description: 'FastAPI microservice sample',
    },
  ];

  it('renders existing repositories tab by default with registered repos', async () => {
    const handleClose = vi.fn();
    const handleSelectRepo = vi.fn();

    render(
      <ConnectRepoModal
        isOpen={true}
        onClose={handleClose}
        activeRepoId="requests"
        onSelectRepo={handleSelectRepo}
      />
    );

    expect(screen.getByTestId('connect-repo-modal')).toBeInTheDocument();
    expect(screen.getByTestId('tab-existing-repos')).toBeInTheDocument();
    expect(screen.getByTestId('tab-add-repo')).toBeInTheDocument();

    // Verify repositories list rendered
    await waitFor(() => {
      expect(screen.getByTestId('repo-card-requests')).toBeInTheDocument();
      expect(screen.getByTestId('repo-card-sample_codebase')).toBeInTheDocument();
    });

    expect(screen.getByText('psf/requests')).toBeInTheDocument();
    expect(screen.getByText('fixtures/requests')).toBeInTheDocument();
    expect(screen.getByText(/284 AST chunks/i)).toBeInTheDocument();
  });

  it('triggers onSelectRepo and closes modal when Open & Query is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSelectRepo = vi.fn();

    render(
      <ConnectRepoModal
        isOpen={true}
        onClose={handleClose}
        activeRepoId="requests"
        onSelectRepo={handleSelectRepo}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('open-repo-btn-sample_codebase')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('open-repo-btn-sample_codebase'));

    expect(handleSelectRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sample_codebase',
      })
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it('allows switching to Add New Repository tab and clicking a quick preset', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <ConnectRepoModal
        isOpen={true}
        onClose={handleClose}
      />
    );

    // Switch to Add New Repository tab
    await user.click(screen.getByTestId('tab-add-repo'));

    expect(screen.getByTestId('repo-path-input')).toBeInTheDocument();
    expect(screen.getByTestId('trigger-index-btn')).toBeInTheDocument();
    expect(screen.getByTestId('preset-requests-btn')).toBeInTheDocument();
    expect(screen.getByTestId('preset-sample-btn')).toBeInTheDocument();

    // Click preset
    await user.click(screen.getByTestId('preset-sample-btn'));
    expect(screen.getByTestId('repo-path-input')).toHaveValue('backend/sample_codebase');
  });
});
