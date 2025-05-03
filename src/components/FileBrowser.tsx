"use client";

import { useState, useMemo } from 'react';

interface FileBrowserProps {
  files: Record<string, string>;
  onFileSelect: (filePath: string) => void;
  selectedFile: string;
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: Record<string, FileNode>;
  content?: string;
}

export default function FileBrowser({ files, onFileSelect, selectedFile }: FileBrowserProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  // Build a tree structure from flat file paths
  const fileTree = useMemo(() => {
    const root: FileNode = { name: 'root', path: '', isDirectory: true, children: {} };
    
    Object.entries(files).forEach(([path, content]) => {
      const parts = path.split('/');
      let currentNode = root;
      
      // Process all path segments except the last one (file name)
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLastPart = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');
        
        if (isLastPart) {
          // This is a file
          currentNode.children[part] = {
            name: part,
            path: currentPath,
            isDirectory: false,
            children: {},
            content
          };
        } else {
          // This is a directory
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

  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    const newExpandedFolders = new Set(expandedFolders);
    if (newExpandedFolders.has(path)) {
      newExpandedFolders.delete(path);
    } else {
      newExpandedFolders.add(path);
    }
    setExpandedFolders(newExpandedFolders);
  };

  // Filter files and folders
  const filteredFileTree = useMemo(() => {
    if (!filter) return fileTree;
    
    // Helper function to search in the tree
    const searchInTree = (node: FileNode): FileNode | null => {
      // If this node matches, return it
      if (node.name.toLowerCase().includes(filter.toLowerCase())) {
        return node;
      }
      
      if (node.isDirectory) {
        // Search in children and collect matches
        const matchingChildren: Record<string, FileNode> = {};
        let hasMatch = false;
        
        Object.entries(node.children).forEach(([name, childNode]) => {
          const match = searchInTree(childNode);
          if (match) {
            matchingChildren[name] = match;
            hasMatch = true;
          }
        });
        
        if (hasMatch) {
          // Return a new node with only matching children
          return {
            ...node,
            children: matchingChildren
          };
        }
      }
      
      return null;
    };
    
    const result = searchInTree(fileTree);
    return result || { name: 'No matches', path: '', isDirectory: true, children: {} };
  }, [fileTree, filter]);

  // Render a file node recursively
  const renderNode = (node: FileNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;
    
    // Folder style
    const folderStyle = "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center";
    
    // File style with highlight for selected file
    const fileStyle = `cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center ${
      isSelected ? 'bg-blue-100 dark:bg-blue-900' : ''
    }`;
    
    if (node.isDirectory) {
      return (
        <div key={node.path}>
          <div 
            className={folderStyle}
            style={{ paddingLeft: `${level * 16}px` }}
            onClick={() => toggleFolder(node.path)}
          >
            <span className="mr-1">{isExpanded ? '📂' : '📁'}</span>
            <span className="truncate">{node.name}</span>
          </div>
          
          {isExpanded && Object.values(node.children).map(childNode => (
            renderNode(childNode, level + 1)
          ))}
        </div>
      );
    } else {
      return (
        <div
          key={node.path}
          className={fileStyle}
          style={{ paddingLeft: `${level * 16}px` }}
          onClick={() => onFileSelect(node.path)}
        >
          <span className="mr-1">📄</span>
          <span className="truncate">{node.name}</span>
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg">
      <div className="p-2 border-b">
        <input
          type="text"
          placeholder="Filter files..."
          className="w-full p-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto p-1">
        <div className="text-sm">
          {Object.values(filteredFileTree.children).map(node => renderNode(node))}
        </div>
      </div>
      
      <div className="text-xs text-gray-500 p-2 border-t">
        {Object.keys(files).length} files
      </div>
    </div>
  );
}