import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectRepoModal } from '../components/repo/ConnectRepoModal';
import { apiClient } from '../services/apiClient';
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

  it('uploads filtered Python files via apiClient.indexUploadedFiles when a folder is picked', async () => {
    const user = userEvent.setup();
    const getReposSpy = vi.spyOn(apiClient, 'getRepositories').mockResolvedValue(sampleRepos);
    const uploadSpy = vi.spyOn(apiClient, 'indexUploadedFiles').mockResolvedValueOnce({
      repo_id: 'my_app',
      repo_path: 'backend/data/uploaded_repos/my_app',
      indexed_files: 1,
      extracted_chunks: 1,
      elapsed_seconds: 0.04,
    });

    try {
      render(
        <ConnectRepoModal
          isOpen={true}
          onClose={vi.fn()}
          onSelectRepo={vi.fn()}
        />
      );

      await user.click(screen.getByTestId('tab-add-repo'));

      const pyFile = new File(['def main():\n    return 1\n'], 'main.py', { type: 'text/x-python' });
      Object.defineProperty(pyFile, 'webkitRelativePath', { value: 'my_app/main.py' });
      Object.defineProperty(pyFile, 'text', { value: async () => 'def main():\n    return 1\n' });

      const envFile = new File(['SECRET=123'], '.env', { type: 'text/plain' });
      Object.defineProperty(envFile, 'webkitRelativePath', { value: 'my_app/.env' });

      const pycFile = new File(['binary'], 'cached.pyc', { type: 'application/octet-stream' });
      Object.defineProperty(pycFile, 'webkitRelativePath', { value: 'my_app/__pycache__/cached.pyc' });

      fireEvent.change(screen.getByTestId('native-folder-input'), {
        target: { files: [pyFile, envFile, pycFile] },
      });

      expect(screen.getByTestId('repo-path-input')).toHaveValue('my_app');

      await user.click(screen.getByTestId('trigger-index-btn'));

      await waitFor(() => {
        expect(uploadSpy).toHaveBeenCalledWith('my_app', [
          { path: 'my_app/main.py', content: 'def main():\n    return 1\n' },
        ]);
      });
    } finally {
      getReposSpy.mockRestore();
      uploadSpy.mockRestore();
    }
  });
});
