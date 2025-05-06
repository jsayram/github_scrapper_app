import React from 'react';

interface RepositoryFormProps {
  repoUrl: string;
  onRepoUrlChange: (value: string) => void;
  githubToken: string;
  onGithubTokenChange: (value: string) => void;
}

const RepositoryForm: React.FC<RepositoryFormProps> = ({
  repoUrl,
  onRepoUrlChange,
  githubToken,
  onGithubTokenChange
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <label
          htmlFor="repoUrl"
          className="block text-sm font-medium mb-1"
        >
          GitHub Repository URL
        </label>
        <input
          id="repoUrl"
          type="text"
          className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
          value={repoUrl}
          onChange={(e) => onRepoUrlChange(e.target.value)}
          placeholder="https://github.com/username/repository"
          required
        />
      </div>

      <div>
        <label
          htmlFor="githubToken"
          className="block text-sm font-medium mb-1"
        >
          GitHub Token (optional)
        </label>
        <input
          id="githubToken"
          type="password"
          className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
          value={githubToken}
          onChange={(e) => onGithubTokenChange(e.target.value)}
          placeholder="ghp_xxxxxxxxxxxx"
        />
        <p className="text-xs text-gray-500 mt-1">
          Required for private repositories
        </p>
      </div>
    </div>
  );
};

export default RepositoryForm;