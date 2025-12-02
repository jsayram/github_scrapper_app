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
  documentationType?: 'architecture' | 'tutorial'; // Set if this is auto-saved documentation
}

export default function SaveToFile({ files, repoUrl, onLoadVersion }: SaveToFileProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [versionName, setVersionName] = useState('');
  const [savedVersions, setSavedVersions] = useState<VersionInfo[]>([]);

  // Load saved versions on component mount
  useEffect(() => {
    loadSavedVersions();
  }, []);

  const loadSavedVersions = async () => {
    try {
      const versions = localStorage.getItem('savedRepoVersions');
      if (versions) {
        // Load basic info, then enrich with documentationType from each version's data
        const basicVersions: VersionInfo[] = JSON.parse(versions);
        const enrichedVersions = basicVersions.map(v => {
          try {
            const versionData = localStorage.getItem(`repoVersion-${v.id}`);
            if (versionData) {
              const parsed = JSON.parse(versionData);
              
              // Check if documentationType is explicitly set
              if (parsed.documentationType) {
                return { ...v, documentationType: parsed.documentationType };
              }
              
              // Auto-detect documentation by checking file structure
              // Documentation versions have files like index.md, 01_xxx.md, 02_xxx.md
              const files = parsed.files || {};
              const fileNames = Object.keys(files);
              const hasIndexMd = fileNames.includes('index.md');
              const hasNumberedMdFiles = fileNames.some(f => /^\d{2}_.*\.md$/.test(f));
              const allAreMdFiles = fileNames.length > 0 && fileNames.every(f => f.endsWith('.md'));
              
              if (hasIndexMd && hasNumberedMdFiles && allAreMdFiles) {
                // This looks like documentation - detect type from name or default to tutorial
                const isArchitecture = v.name.toLowerCase().includes('architecture');
                return { ...v, documentationType: isArchitecture ? 'architecture' : 'tutorial' as const };
              }
            }
          } catch {
            // Ignore errors for individual versions
          }
          return v;
        });
        setSavedVersions(enrichedVersions);
      }
    } catch (error) {
      console.error('Error loading saved versions:', error);
    }
  };

  const handleSave = async () => {
    if (!versionName.trim()) {
      setSaveMessage('Please enter a version name');
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage('Preparing files...');

      const versionId = `repo-${Date.now().toString(36)}`;
      const versionInfo: VersionInfo = {
        id: versionId,
        name: versionName,
        timestamp: new Date().toISOString(),
        repository: repoUrl,
        fileCount: Object.keys(files).length,
      };

      const dataToSave = {
        ...versionInfo,
        files
      };

      const versions = [...savedVersions, versionInfo];
      localStorage.setItem('savedRepoVersions', JSON.stringify(versions));
      localStorage.setItem(`repoVersion-${versionId}`, JSON.stringify(dataToSave));
      
      setSavedVersions(versions);
      setSaveMessage(`✓ Saved "${versionName}"`);
      setVersionName('');
      
      // Auto-download
      downloadAsFile(dataToSave, versionName);
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(''), 3000);
      
    } catch (error) {
      setSaveMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const downloadAsFile = (data: any, name: string) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const sanitizedName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${sanitizedName}-${new Date().toISOString().slice(0, 10)}.json`;
    
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
      const savedData = localStorage.getItem(`repoVersion-${versionId}`);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        onLoadVersion(parsedData.files, {
          id: parsedData.id,
          name: parsedData.name,
          timestamp: parsedData.timestamp,
          repository: parsedData.repository,
          fileCount: parsedData.fileCount,
          documentationType: parsedData.documentationType, // Pass doc type if present
        });
      }
    } catch (error) {
      console.error('Error loading version:', error);
    }
  };

  const deleteVersion = async (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      localStorage.removeItem(`repoVersion-${versionId}`);
      const updatedVersions = savedVersions.filter(v => v.id !== versionId);
      localStorage.setItem('savedRepoVersions', JSON.stringify(updatedVersions));
      setSavedVersions(updatedVersions);
    } catch (error) {
      console.error('Error deleting version:', error);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Version Manager</h3>
      </div>

      {/* Save New Version */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Save Current State
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder="Version name (e.g., v1.0, initial)"
            className="flex-1 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isSaving}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button 
            type="button"
            onClick={handleSave}
            disabled={isSaving || Object.keys(files).length === 0 || !versionName.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            )}
            Save
          </button>
        </div>
        {saveMessage && (
          <p className={`mt-2 text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {saveMessage}
          </p>
        )}
      </div>

      {/* Saved Versions List */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Saved Versions ({savedVersions.length})
        </label>
        
        {savedVersions.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <svg className="h-8 w-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <p className="text-sm">No saved versions yet</p>
            <p className="text-xs mt-1">Save your crawled files to load them later</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {savedVersions.slice().reverse().map(version => {
              const isDocumentation = !!version.documentationType;
              const docTypeLabel = version.documentationType === 'architecture' ? '🏗️ Architecture' : '📚 Tutorial';
              
              return (
                <div 
                  key={version.id} 
                  className={`group flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    isDocumentation 
                      ? 'border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20'
                      : 'dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                  }`}
                  onClick={() => loadVersion(version.id)}
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    isDocumentation 
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-purple-100 dark:bg-purple-900/30'
                  }`}>
                    {isDocumentation ? (
                      <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {version.name}
                      </span>
                      {isDocumentation ? (
                        <span className="flex-shrink-0 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full font-medium">
                          {docTypeLabel}
                        </span>
                      ) : (
                        <span className="flex-shrink-0 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {version.fileCount} files
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <span>{formatDate(version.timestamp)}</span>
                      {isDocumentation && (
                        <>
                          <span>•</span>
                          <span className="text-green-600 dark:text-green-400">
                            {version.fileCount} chapters • Click to view
                          </span>
                        </>
                      )}
                      {!isDocumentation && (
                        <>
                          <span>•</span>
                          <span className="truncate" title={version.repository}>
                            {version.repository.replace('https://github.com/', '')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={(e) => deleteVersion(version.id, e)}
                    className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete version"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}