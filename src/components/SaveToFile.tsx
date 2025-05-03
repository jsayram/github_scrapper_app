"use client";

import { useState, useEffect } from 'react';

interface SaveToFileProps {
  files: Record<string, string>;
  repoUrl: string;
  onLoadVersion: (files: Record<string, string>, versionInfo: VersionInfo) => void;
}

export interface VersionInfo {
  id: string;
  name: string;
  timestamp: string;
  repository: string;
  fileCount: number;
}

export default function SaveToFile({ files, repoUrl, onLoadVersion }: SaveToFileProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [versionName, setVersionName] = useState('');
  const [savedVersions, setSavedVersions] = useState<VersionInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  // Load saved versions on component mount
  useEffect(() => {
    loadSavedVersions();
  }, []);

  const loadSavedVersions = async () => {
    try {
      // In a real app, this would be an API call
      // For now, we'll use localStorage
      const versions = localStorage.getItem('savedRepoVersions');
      if (versions) {
        setSavedVersions(JSON.parse(versions));
      }
    } catch (error) {
      console.error('Error loading saved versions:', error);
    }
  };

  const toggleFileSelection = (filePath: string) => {
    setSelectedFiles(prev => 
      prev.includes(filePath) 
        ? prev.filter(f => f !== filePath)
        : [...prev, filePath]
    );
  };

  const toggleSelectMode = () => {
    setSelectMode(prev => !prev);
    setSelectedFiles(selectMode ? [] : Object.keys(files));
  };

  const handleSave = async () => {
    if (!versionName.trim()) {
      setSaveMessage('Please enter a version name');
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage('Preparing files...');

      // Filter files if in select mode
      const filesToSave = selectMode 
        ? Object.fromEntries(
            Object.entries(files).filter(([path]) => selectedFiles.includes(path))
          )
        : files;

      // Create a unique ID for this version
      const versionId = `repo-${Date.now().toString(36)}`;

      // Create version info
      const versionInfo: VersionInfo = {
        id: versionId,
        name: versionName,
        timestamp: new Date().toISOString(),
        repository: repoUrl,
        fileCount: Object.keys(filesToSave).length,
      };

      // Create the data to save
      const dataToSave = {
        ...versionInfo,
        files: filesToSave
      };

      // Save to localStorage (in a real app, this would be an API call)
      const versions = [...savedVersions, versionInfo];
      localStorage.setItem('savedRepoVersions', JSON.stringify(versions));
      localStorage.setItem(`repoVersion-${versionId}`, JSON.stringify(dataToSave));
      
      // Update state
      setSavedVersions(versions);
      setSaveMessage(`Saved version "${versionName}" with ${Object.keys(filesToSave).length} files`);
      setVersionName('');
      
      // Also download as a file
      downloadAsFile(dataToSave, versionName);
      
    } catch (error) {
      setSaveMessage(`Error saving files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const downloadAsFile = (data: any, name: string) => {
    // Create JSON file
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    
    // Create a sanitized filename
    const sanitizedName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${sanitizedName}-${new Date().toISOString().slice(0, 10)}.json`;
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadVersion = async (versionId: string) => {
    try {
      // In a real app, this would be an API call
      const savedData = localStorage.getItem(`repoVersion-${versionId}`);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        onLoadVersion(parsedData.files, {
          id: parsedData.id,
          name: parsedData.name,
          timestamp: parsedData.timestamp,
          repository: parsedData.repository,
          fileCount: parsedData.fileCount
        });
        setShowVersions(false);
      }
    } catch (error) {
      console.error('Error loading version:', error);
    }
  };

  const deleteVersion = async (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    
    try {
      // Remove from localStorage
      localStorage.removeItem(`repoVersion-${versionId}`);
      
      // Update versions list
      const updatedVersions = savedVersions.filter(v => v.id !== versionId);
      localStorage.setItem('savedRepoVersions', JSON.stringify(updatedVersions));
      setSavedVersions(updatedVersions);
    } catch (error) {
      console.error('Error deleting version:', error);
    }
  };

  return (
    <div className="mt-4 relative">
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={() => setShowVersions(prev => !prev)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none"
        >
          {showVersions ? 'Hide Versions' : 'Manage Versions'}
        </button>

        {!showVersions && (
          <>
            <button 
              onClick={toggleSelectMode}
              className={`rounded-md px-4 py-2 text-sm font-medium focus:outline-none ${
                selectMode 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {selectMode ? `Selected: ${selectedFiles.length}` : 'Select Files'}
            </button>
          
            <div className="flex flex-grow gap-2">
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="Version name..."
                className="flex-grow rounded-md border p-2 text-sm dark:bg-gray-800 dark:border-gray-700"
                disabled={isSaving}
              />
              
              <button 
                onClick={handleSave}
                disabled={isSaving || Object.keys(files).length === 0 || !versionName.trim()}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none disabled:bg-gray-400"
              >
                {isSaving ? 'Saving...' : 'Save Version'}
              </button>
            </div>
          </>
        )}
      </div>
      
      {saveMessage && (
        <p className={`mt-2 text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {saveMessage}
        </p>
      )}

      {/* File selection list */}
      {selectMode && !showVersions && (
        <div className="mt-4 border p-4 rounded-md max-h-64 overflow-y-auto">
          <div className="flex justify-between mb-2">
            <h3 className="font-medium">Select Files to Save</h3>
            <div>
              <button 
                onClick={() => setSelectedFiles(Object.keys(files))} 
                className="text-xs text-blue-600 mr-2"
              >
                Select All
              </button>
              <button 
                onClick={() => setSelectedFiles([])} 
                className="text-xs text-red-600"
              >
                Deselect All
              </button>
            </div>
          </div>
          <ul className="space-y-1">
            {Object.keys(files).map(filePath => (
              <li key={filePath} className="flex items-center">
                <input 
                  type="checkbox"
                  id={`file-${filePath}`}
                  checked={selectedFiles.includes(filePath)}
                  onChange={() => toggleFileSelection(filePath)}
                  className="mr-2"
                />
                <label 
                  htmlFor={`file-${filePath}`} 
                  className="text-sm truncate cursor-pointer"
                  title={filePath}
                >
                  {filePath}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Versions list */}
      {showVersions && (
        <div className="mt-4 border p-4 rounded-md max-h-96 overflow-y-auto">
          <h3 className="font-medium mb-3">Saved Versions</h3>
          {savedVersions.length === 0 ? (
            <p className="text-gray-500 italic">No saved versions yet</p>
          ) : (
            <ul className="space-y-2">
              {savedVersions.map(version => (
                <li 
                  key={version.id} 
                  className="border rounded p-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => loadVersion(version.id)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{version.name}</span>
                    <button
                      onClick={(e) => deleteVersion(version.id, e)}
                      className="text-red-500 hover:text-red-700 text-sm"
                      title="Delete version"
                    >
                      ×
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 flex justify-between mt-1">
                    <span>
                      {new Date(version.timestamp).toLocaleDateString()} 
                      {' • '}
                      {version.fileCount} files
                    </span>
                    <span className="truncate max-w-xs" title={version.repository}>
                      {version.repository.replace('https://github.com/', '')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}