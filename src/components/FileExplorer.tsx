import React from 'react';
import FileBrowser from './FileBrowser';
import CodeEditor from './CodeEditor';

interface FileExplorerProps {
  files: Record<string, string>;
  selectedFile: string;
  onFileSelect: (filePath: string) => void;
  fileContent: string;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  selectedFile,
  onFileSelect,
  fileContent
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="md:col-span-1 h-[400px] overflow-hidden border rounded-md">
        <FileBrowser
          files={files}
          onFileSelect={onFileSelect}
          selectedFile={selectedFile}
        />
      </div>

      <div className="md:col-span-3">
        {selectedFile ? (
          <CodeEditor
            code={fileContent}
            filePath={selectedFile}
            readOnly={true}
          />
        ) : (
          <div className="h-full flex items-center justify-center border rounded-lg text-gray-500">
            <div className="text-center">
              <p className="mb-2">👈 Select a file from the browser</p>
              <p className="text-sm">
                Files will be displayed in the editor
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;