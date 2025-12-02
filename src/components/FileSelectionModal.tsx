"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { TokenWarning } from './TokenWarning';

interface FileSelectionModalProps {
  files: Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedFiles: Record<string, string>) => void;
  isProcessing?: boolean;
  /** LLM provider ID for token estimation */
  providerId?: string;
  /** LLM model ID for token estimation */
  modelId?: string;
  /** Documentation mode - affects token estimation */
  documentationMode?: 'tutorial' | 'architecture';
  /** Callback when user wants to change model */
  onModelChange?: (providerId: string, modelId: string) => void;
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: Record<string, FileNode>;
  size?: number;
}

// Language icons/colors mapping
const languageConfig: Record<string, { icon: string; color: string }> = {
  ts: { icon: '🔷', color: 'text-blue-500' },
  tsx: { icon: '⚛️', color: 'text-blue-400' },
  js: { icon: '🟨', color: 'text-yellow-500' },
  jsx: { icon: '⚛️', color: 'text-yellow-400' },
  py: { icon: '🐍', color: 'text-green-500' },
  java: { icon: '☕', color: 'text-orange-500' },
  cs: { icon: '🟣', color: 'text-purple-500' },
  md: { icon: '📝', color: 'text-gray-500' },
  json: { icon: '📋', color: 'text-gray-400' },
  css: { icon: '🎨', color: 'text-pink-500' },
  html: { icon: '🌐', color: 'text-orange-400' },
  default: { icon: '📄', color: 'text-gray-400' }
};

function getLanguageConfig(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return languageConfig[ext] || languageConfig.default;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileSelectionModal({
  files,
  isOpen,
  onClose,
  onConfirm,
  isProcessing = false,
  providerId = 'openai',
  modelId = 'gpt-4o-mini',
  documentationMode = 'architecture',
  onModelChange,
}: FileSelectionModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set(Object.keys(files)));
  const [filter, setFilter] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'type'>('name');

  // Initialize selection when files change
  React.useEffect(() => {
    setSelectedFiles(new Set(Object.keys(files)));
  }, [files]);

  // Build file tree
  const fileTree = useMemo(() => {
    const root: FileNode = { name: 'root', path: '', isDirectory: true, children: {} };
    
    Object.entries(files).forEach(([path, content]) => {
      const parts = path.split('/');
      let currentNode = root;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLastPart = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');
        
        if (isLastPart) {
          currentNode.children[part] = {
            name: part,
            path: currentPath,
            isDirectory: false,
            children: {},
            size: content.length
          };
        } else {
          if (!currentNode.children[part]) {
            currentNode.children[part] = {
              name: part,
              path: currentPath,
              isDirectory: true,
              children: {}
            };
          }
          currentNode = currentNode.children[part];
        }
      }
    });
    
    return root;
  }, [files]);

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let fileList = Object.entries(files);
    
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      fileList = fileList.filter(([path]) => 
        path.toLowerCase().includes(lowerFilter)
      );
    }
    
    // Sort
    fileList.sort(([pathA, contentA], [pathB, contentB]) => {
      switch (sortBy) {
        case 'size':
          return contentB.length - contentA.length;
        case 'type':
          const extA = pathA.split('.').pop() || '';
          const extB = pathB.split('.').pop() || '';
          return extA.localeCompare(extB);
        default:
          return pathA.localeCompare(pathB);
      }
    });
    
    return fileList;
  }, [files, filter, sortBy]);

  // Selection helpers
  const toggleFile = useCallback((path: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedFiles(new Set(filteredFiles.map(([path]) => path)));
  }, [filteredFiles]);

  const deselectAll = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  const selectByExtension = useCallback((ext: string) => {
    const matchingFiles = Object.keys(files).filter(path => 
      path.toLowerCase().endsWith(`.${ext}`)
    );
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      matchingFiles.forEach(f => newSet.add(f));
      return newSet;
    });
  }, [files]);

  const deselectByExtension = useCallback((ext: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      Array.from(newSet).forEach(path => {
        if (path.toLowerCase().endsWith(`.${ext}`)) {
          newSet.delete(path);
        }
      });
      return newSet;
    });
  }, []);

  // Get extension breakdown
  const extensionStats = useMemo(() => {
    const stats: Record<string, { total: number; selected: number; size: number }> = {};
    
    Object.entries(files).forEach(([path, content]) => {
      const ext = path.split('.').pop()?.toLowerCase() || 'other';
      if (!stats[ext]) {
        stats[ext] = { total: 0, selected: 0, size: 0 };
      }
      stats[ext].total++;
      stats[ext].size += content.length;
      if (selectedFiles.has(path)) {
        stats[ext].selected++;
      }
    });
    
    return Object.entries(stats).sort((a, b) => b[1].total - a[1].total);
  }, [files, selectedFiles]);

  // Calculate totals
  const totalSize = useMemo(() => {
    return Array.from(selectedFiles).reduce((sum, path) => {
      return sum + (files[path]?.length || 0);
    }, 0);
  }, [selectedFiles, files]);

  const totalChars = useMemo(() => {
    return Array.from(selectedFiles).reduce((sum, path) => {
      return sum + (files[path]?.length || 0);
    }, 0);
  }, [selectedFiles, files]);

  const handleConfirm = () => {
    const selected: Record<string, string> = {};
    selectedFiles.forEach(path => {
      if (files[path]) {
        selected[path] = files[path];
      }
    });
    onConfirm(selected);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span>{documentationMode === 'architecture' ? '🏗️' : '📚'}</span>
              Select Files for {documentationMode === 'architecture' ? 'Architecture Documentation' : 'Tutorial Generation'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Stats bar */}
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="font-medium text-blue-600 dark:text-blue-400">{selectedFiles.size}</span>
              <span>of {Object.keys(files).length} files selected</span>
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="flex items-center gap-1">
              <span className="font-medium">{formatFileSize(totalSize)}</span>
              <span>total</span>
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="flex items-center gap-1">
              <span className="font-medium">{totalChars.toLocaleString()}</span>
              <span>characters</span>
            </span>
          </div>
          
          {/* Token Warning - Show estimated tokens and warnings */}
          {selectedFiles.size > 0 && (
            <TokenWarning
              files={Array.from(selectedFiles).map(path => ({ path, content: files[path] || '' }))}
              providerId={providerId}
              modelId={modelId}
              documentationMode={documentationMode}
              onModelSuggestionClick={onModelChange}
              className="mt-3"
            />
          )}
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Filter files..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'size' | 'type')}
              className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="name">Sort by Name</option>
              <option value="size">Sort by Size</option>
              <option value="type">Sort by Type</option>
            </select>

            {/* Quick actions */}
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* File list */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-1">
              {filteredFiles.map(([path, content]) => {
                const config = getLanguageConfig(path);
                const isSelected = selectedFiles.has(path);
                
                return (
                  <label
                    key={path}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFile(path)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className={config.color}>{config.icon}</span>
                    <span className="flex-1 text-sm truncate" title={path}>
                      {path}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatFileSize(content.length)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Sidebar - Extension breakdown */}
          <div className="w-64 border-l dark:border-gray-700 p-3 overflow-y-auto bg-gray-50 dark:bg-gray-800/30">
            <h3 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
              File Types
            </h3>
            <div className="space-y-2">
              {extensionStats.map(([ext, stats]) => {
                const config = getLanguageConfig(`file.${ext}`);
                const allSelected = stats.selected === stats.total;
                const someSelected = stats.selected > 0 && stats.selected < stats.total;
                
                return (
                  <div
                    key={ext}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-800 border dark:border-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={() => {
                        if (allSelected || someSelected) {
                          deselectByExtension(ext);
                        } else {
                          selectByExtension(ext);
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className={config.color}>{config.icon}</span>
                    <span className="flex-1 text-sm font-medium">.{ext}</span>
                    <span className="text-xs text-gray-500">
                      {stats.selected}/{stats.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedFiles.size === 0 ? (
                <span className="text-amber-600 dark:text-amber-400">
                  ⚠️ Please select at least one file
                </span>
              ) : (
                <span>
                  Ready to generate {documentationMode === 'architecture' ? 'architecture docs' : 'tutorial'} with {selectedFiles.size} files
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedFiles.size === 0 || isProcessing}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    Generate {documentationMode === 'architecture' ? 'Architecture Docs' : 'Tutorial'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
