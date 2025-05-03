"use client";

import { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface FileSummaryProps {
  files: Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
}

interface FileTypeCount {
  name: string;
  count: number;
  size: number;
}

interface DirectoryInfo {
  name: string;
  count: number;
}

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', 
  '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'
];

export default function FileSummary({ files, isOpen, onClose }: FileSummaryProps) {
  const [activeTab, setActiveTab] = useState<'fileTypes' | 'directories' | 'overview'>('overview');

  if (!isOpen) return null;

  // Get file extensions and count
  const getFileTypeCounts = (): FileTypeCount[] => {
    const typeCounts: Record<string, { count: number; size: number }> = {};
    
    Object.entries(files).forEach(([path, content]) => {
      const extension = path.split('.').pop()?.toLowerCase() || 'unknown';
      const size = new Blob([content]).size;
      
      if (!typeCounts[extension]) {
        typeCounts[extension] = { count: 0, size: 0 };
      }
      
      typeCounts[extension].count += 1;
      typeCounts[extension].size += size;
    });
    
    return Object.entries(typeCounts).map(([name, { count, size }]) => ({
      name,
      count,
      size
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 file types
  };

  // Get directories and file count
  const getDirectoryCounts = (): DirectoryInfo[] => {
    const dirCounts: Record<string, number> = {};
    
    Object.keys(files).forEach(path => {
      const parts = path.split('/');
      if (parts.length > 1) {
        const dir = parts[0];
        dirCounts[dir] = (dirCounts[dir] || 0) + 1;
      }
    });
    
    return Object.entries(dirCounts).map(([name, count]) => ({
      name,
      count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 directories
  };

  // Get overview statistics
  const getOverviewStats = () => {
    const totalFiles = Object.keys(files).length;
    const totalSize = Object.values(files)
      .reduce((sum, content) => sum + new Blob([content]).size, 0);
    
    // Calculate average file size
    const averageSize = totalFiles > 0 ? totalSize / totalFiles : 0;
    
    // Get most common extensions
    const extensionCounts: Record<string, number> = {};
    Object.keys(files).forEach(path => {
      const extension = path.split('.').pop()?.toLowerCase() || 'unknown';
      extensionCounts[extension] = (extensionCounts[extension] || 0) + 1;
    });
    
    const topExtensions = Object.entries(extensionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    // Get deepest nested file
    let deepestPath = '';
    let maxDepth = 0;
    
    Object.keys(files).forEach(path => {
      const depth = path.split('/').length;
      if (depth > maxDepth) {
        maxDepth = depth;
        deepestPath = path;
      }
    });
    
    return {
      totalFiles,
      totalSize,
      averageSize,
      topExtensions,
      deepestPath,
      maxDepth
    };
  };

  const fileTypeCounts = getFileTypeCounts();
  const directoryCounts = getDirectoryCounts();
  const overviewStats = getOverviewStats();

  // Format size in bytes to a more readable format
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center border-b p-4">
          <h2 className="text-xl font-bold">Repository Summary</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
          >
            ✕
          </button>
        </div>
        
        <div className="flex border-b">
          <button 
            className={`px-4 py-2 ${activeTab === 'overview' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'fileTypes' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('fileTypes')}
          >
            File Types
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'directories' ? 'border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('directories')}
          >
            Directories
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'overview' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-4">Repository Statistics</h3>
                  <ul className="space-y-4">
                    <li className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Total Files:</span>
                      <span className="font-medium">{overviewStats.totalFiles.toLocaleString()}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Total Size:</span>
                      <span className="font-medium">{formatSize(overviewStats.totalSize)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Average File Size:</span>
                      <span className="font-medium">{formatSize(overviewStats.averageSize)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Directory Depth:</span>
                      <span className="font-medium">{overviewStats.maxDepth}</span>
                    </li>
                    <li>
                      <span className="text-gray-600 dark:text-gray-300 block mb-2">Deepest Path:</span>
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-1 rounded block overflow-hidden text-ellipsis">
                        {overviewStats.deepestPath}
                      </span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-4">Top File Extensions</h3>
                  <ul className="space-y-2">
                    {overviewStats.topExtensions.map(([ext, count], index) => (
                      <li key={ext} className="flex justify-between items-center">
                        <div className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-mono">.{ext}</span>
                        </div>
                        <span>
                          {count} file{count !== 1 ? 's' : ''}
                          <span className="text-gray-500 ml-1">
                            ({Math.round(count / overviewStats.totalFiles * 100)}%)
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'fileTypes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">File Type Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fileTypeCounts}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {fileTypeCounts.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} files`, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-4">File Size by Type</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fileTypeCounts}>
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => formatSize(value)} />
                      <Tooltip formatter={(value) => [formatSize(value as number), 'Size']} />
                      <Bar dataKey="size" fill="#8884d8">
                        {fileTypeCounts.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold mb-4">File Types Details</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Extension</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Size</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Average Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {fileTypeCounts.map((type) => (
                        <tr key={type.name}>
                          <td className="px-6 py-4 whitespace-nowrap font-mono">.{type.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{type.count}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{formatSize(type.size)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{formatSize(type.size / type.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'directories' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Files by Directory</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={directoryCounts}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8">
                      {directoryCounts.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Directory Details</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Directory</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Files</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percent of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {directoryCounts.map((dir) => (
                        <tr key={dir.name}>
                          <td className="px-6 py-4 whitespace-nowrap font-mono">{dir.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{dir.count}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {Math.round(dir.count / overviewStats.totalFiles * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="border-t p-4 flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded focus:outline-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}