"use client";

import React, { useState, useMemo, useCallback } from 'react';

export interface FileTypeInfo {
  extension: string;
  label: string;
  count: number;
  totalSize: number;
  icon: string;
  color: string;
  pattern: string;
}

interface FileTypeSelectorProps {
  detectedTypes: FileTypeInfo[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedPatterns: string[]) => void;
  repoName?: string;
}

// Mapping extensions to friendly names and icons
const extensionInfo: Record<string, { label: string; icon: string; color: string; pattern: string }> = {
  py: { label: 'Python', icon: '🐍', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', pattern: '*.py' },
  js: { label: 'JavaScript', icon: '🟨', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', pattern: '*.js' },
  ts: { label: 'TypeScript', icon: '🔷', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', pattern: '*.ts' },
  tsx: { label: 'TSX', icon: '⚛️', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', pattern: '*.tsx' },
  jsx: { label: 'JSX', icon: '⚛️', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', pattern: '*.jsx' },
  cs: { label: 'C#', icon: '🟣', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', pattern: '*.cs' },
  java: { label: 'Java', icon: '☕', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', pattern: '*.java' },
  md: { label: 'Markdown', icon: '📝', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', pattern: '*.md' },
  mdx: { label: 'MDX', icon: '📝', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', pattern: '*.mdx' },
  json: { label: 'JSON', icon: '📋', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', pattern: '*.json' },
  html: { label: 'HTML', icon: '🌐', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', pattern: '*.html' },
  css: { label: 'CSS', icon: '🎨', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400', pattern: '*.css' },
  scss: { label: 'SCSS', icon: '🎨', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400', pattern: '*.scss' },
  sass: { label: 'SASS', icon: '🎨', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400', pattern: '*.sass' },
  rs: { label: 'Rust', icon: '🦀', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', pattern: '*.rs' },
  go: { label: 'Go', icon: '🐹', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400', pattern: '*.go' },
  rb: { label: 'Ruby', icon: '💎', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', pattern: '*.rb' },
  php: { label: 'PHP', icon: '🐘', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400', pattern: '*.php' },
  swift: { label: 'Swift', icon: '🐦', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', pattern: '*.swift' },
  c: { label: 'C', icon: '🔧', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', pattern: '*.c' },
  cpp: { label: 'C++', icon: '🔧', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', pattern: '*.cpp' },
  h: { label: 'C Header', icon: '📄', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', pattern: '*.h' },
  hpp: { label: 'C++ Header', icon: '📄', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', pattern: '*.hpp' },
  sql: { label: 'SQL', icon: '🗃️', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', pattern: '*.sql' },
  kt: { label: 'Kotlin', icon: '🟠', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', pattern: '*.kt' },
  dart: { label: 'Dart', icon: '🎯', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', pattern: '*.dart' },
  sh: { label: 'Shell', icon: '🐚', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', pattern: '*.sh' },
  yml: { label: 'YAML', icon: '⚙️', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', pattern: '*.yml' },
  yaml: { label: 'YAML', icon: '⚙️', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', pattern: '*.yaml' },
  xml: { label: 'XML', icon: '📄', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', pattern: '*.xml' },
  vue: { label: 'Vue', icon: '💚', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', pattern: '*.vue' },
  svelte: { label: 'Svelte', icon: '🔥', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', pattern: '*.svelte' },
  astro: { label: 'Astro', icon: '🚀', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', pattern: '*.astro' },
  graphql: { label: 'GraphQL', icon: '◆', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400', pattern: '*.graphql' },
  prisma: { label: 'Prisma', icon: '🔷', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', pattern: '*.prisma' },
  proto: { label: 'Protobuf', icon: '📦', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', pattern: '*.proto' },
  toml: { label: 'TOML', icon: '⚙️', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', pattern: '*.toml' },
  env: { label: 'Environment', icon: '🔐', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400', pattern: '*.env*' },
};

// Get info for an extension
export function getExtensionInfo(ext: string): { label: string; icon: string; color: string; pattern: string } {
  return extensionInfo[ext.toLowerCase()] || {
    label: ext.toUpperCase(),
    icon: '📄',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
    pattern: `*.${ext}`
  };
}

// Analyze files and detect types
export function detectFileTypes(files: Record<string, string>): FileTypeInfo[] {
  const typeMap = new Map<string, { count: number; totalSize: number }>();
  
  Object.entries(files).forEach(([path, content]) => {
    const ext = path.split('.').pop()?.toLowerCase() || 'unknown';
    const existing = typeMap.get(ext) || { count: 0, totalSize: 0 };
    typeMap.set(ext, {
      count: existing.count + 1,
      totalSize: existing.totalSize + content.length
    });
  });
  
  return Array.from(typeMap.entries())
    .map(([ext, stats]) => {
      const info = getExtensionInfo(ext);
      return {
        extension: ext,
        label: info.label,
        count: stats.count,
        totalSize: stats.totalSize,
        icon: info.icon,
        color: info.color,
        pattern: info.pattern
      };
    })
    .sort((a, b) => b.count - a.count);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Recommended code file extensions (for "Select Code Files" quick action)
const CODE_EXTENSIONS = new Set([
  'py', 'js', 'ts', 'tsx', 'jsx', 'cs', 'java', 'rb', 'php', 'go', 'rs',
  'swift', 'kt', 'kts', 'dart', 'c', 'cpp', 'cc', 'h', 'hpp', 'sql',
  'sh', 'bash', 'vue', 'svelte', 'astro', 'scala', 'clj', 'ex', 'exs',
  'hs', 'erl', 'lua', 'r', 'jl', 'm', 'pl', 'pm', 'groovy', 'fs', 'fsx',
  're', 'rei'
]);

// Documentation extensions
const DOC_EXTENSIONS = new Set(['md', 'mdx', 'txt', 'rst', 'adoc']);

// Config extensions
const CONFIG_EXTENSIONS = new Set([
  'json', 'yml', 'yaml', 'xml', 'toml', 'ini', 'conf', 'config',
  'env', 'properties', 'tf', 'graphql', 'gql', 'prisma', 'proto'
]);

export default function FileTypeSelector({
  detectedTypes,
  isOpen,
  onClose,
  onConfirm,
  repoName = 'Repository'
}: FileTypeSelectorProps) {
  // Start with code files pre-selected
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    detectedTypes.forEach(type => {
      if (CODE_EXTENSIONS.has(type.extension) || DOC_EXTENSIONS.has(type.extension)) {
        initial.add(type.extension);
      }
    });
    return initial;
  });

  // Update selection when detected types change
  React.useEffect(() => {
    const initial = new Set<string>();
    detectedTypes.forEach(type => {
      if (CODE_EXTENSIONS.has(type.extension) || DOC_EXTENSIONS.has(type.extension)) {
        initial.add(type.extension);
      }
    });
    setSelectedTypes(initial);
  }, [detectedTypes]);

  // Calculate stats
  const stats = useMemo(() => {
    let totalFiles = 0;
    let selectedFiles = 0;
    let totalSize = 0;
    let selectedSize = 0;
    
    detectedTypes.forEach(type => {
      totalFiles += type.count;
      totalSize += type.totalSize;
      if (selectedTypes.has(type.extension)) {
        selectedFiles += type.count;
        selectedSize += type.totalSize;
      }
    });
    
    return { totalFiles, selectedFiles, totalSize, selectedSize };
  }, [detectedTypes, selectedTypes]);

  // Toggle handlers
  const toggleType = useCallback((ext: string) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ext)) {
        newSet.delete(ext);
      } else {
        newSet.add(ext);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedTypes(new Set(detectedTypes.map(t => t.extension)));
  }, [detectedTypes]);

  const deselectAll = useCallback(() => {
    setSelectedTypes(new Set());
  }, []);

  const selectCodeFiles = useCallback(() => {
    const codeTypes = detectedTypes.filter(t => CODE_EXTENSIONS.has(t.extension));
    setSelectedTypes(new Set(codeTypes.map(t => t.extension)));
  }, [detectedTypes]);

  const selectDocsAndCode = useCallback(() => {
    const types = detectedTypes.filter(t => 
      CODE_EXTENSIONS.has(t.extension) || DOC_EXTENSIONS.has(t.extension)
    );
    setSelectedTypes(new Set(types.map(t => t.extension)));
  }, [detectedTypes]);

  const handleConfirm = useCallback(() => {
    // Generate patterns that match files in any directory
    const patterns: string[] = [];
    detectedTypes
      .filter(type => selectedTypes.has(type.extension))
      .forEach(type => {
        // Add both root-level and recursive patterns
        patterns.push(`*.${type.extension}`);      // Match root files
        patterns.push(`**/*.${type.extension}`);   // Match files in subdirectories
      });
    onConfirm(patterns);
  }, [selectedTypes, detectedTypes, onConfirm]);

  // Group types by category
  const groupedTypes = useMemo(() => {
    const groups: Record<string, FileTypeInfo[]> = {
      'Code Files': [],
      'Documentation': [],
      'Configuration': [],
      'Other': []
    };
    
    detectedTypes.forEach(type => {
      if (CODE_EXTENSIONS.has(type.extension)) {
        groups['Code Files'].push(type);
      } else if (DOC_EXTENSIONS.has(type.extension)) {
        groups['Documentation'].push(type);
      } else if (CONFIG_EXTENSIONS.has(type.extension)) {
        groups['Configuration'].push(type);
      } else {
        groups['Other'].push(type);
      }
    });
    
    return groups;
  }, [detectedTypes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span>🔍</span>
              Select File Types
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
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Found <span className="font-medium text-blue-600 dark:text-blue-400">{stats.totalFiles}</span> files 
            in <span className="font-medium">{repoName}</span>. 
            Select which file types to include in the tutorial.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="p-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Quick:</span>
            <button
              onClick={selectAll}
              className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              All
            </button>
            <button
              onClick={selectCodeFiles}
              className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
            >
              Code Only
            </button>
            <button
              onClick={selectDocsAndCode}
              className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
            >
              Code + Docs
            </button>
            <button
              onClick={deselectAll}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* File Types List */}
        <div className="flex-1 overflow-y-auto p-4">
          {Object.entries(groupedTypes).map(([groupName, types]) => {
            if (types.length === 0) return null;
            
            const allSelected = types.every(t => selectedTypes.has(t.extension));
            const someSelected = types.some(t => selectedTypes.has(t.extension)) && !allSelected;
            
            return (
              <div key={groupName} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={() => {
                      if (allSelected || someSelected) {
                        // Deselect all in group
                        setSelectedTypes(prev => {
                          const newSet = new Set(prev);
                          types.forEach(t => newSet.delete(t.extension));
                          return newSet;
                        });
                      } else {
                        // Select all in group
                        setSelectedTypes(prev => {
                          const newSet = new Set(prev);
                          types.forEach(t => newSet.add(t.extension));
                          return newSet;
                        });
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {groupName}
                  </h3>
                  <span className="text-xs text-gray-500">
                    ({types.reduce((sum, t) => sum + t.count, 0)} files)
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 ml-6">
                  {types.map(type => {
                    const isSelected = selectedTypes.has(type.extension);
                    return (
                      <label
                        key={type.extension}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleType(type.extension)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-lg">{type.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{type.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {type.count} files · {formatFileSize(type.totalSize)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selectedTypes.size === 0 ? (
                <span className="text-amber-600 dark:text-amber-400">
                  ⚠️ Select at least one file type
                </span>
              ) : (
                <span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">{stats.selectedFiles}</span> files selected
                  ({formatFileSize(stats.selectedSize)})
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedTypes.size === 0}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <span>✓</span>
                Continue with {stats.selectedFiles} Files
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
