"use client";

import { useRef, useEffect, useState } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor';

interface CodeEditorProps {
  code: string;
  language?: string;
  readOnly?: boolean;
  filePath: string;
}

export default function CodeEditor({ code, language, readOnly = true, filePath }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [editorLanguage, setEditorLanguage] = useState<string>(language || 'plaintext');
  const [theme, setTheme] = useState<string>('vs-dark');
  const [fileStats, setFileStats] = useState<{
    lineCount: number;
    charCount: number;
    wordCount: number;
    functionCount: number;
    classCount: number;
    commentCount: number;
  }>({
    lineCount: 0,
    charCount: 0,
    wordCount: 0,
    functionCount: 0,
    classCount: 0,
    commentCount: 0
  });

  // Infer language from file extension if not provided
  useEffect(() => {
    if (!language) {
      const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
      
      // Map common file extensions to languages
      const extensionToLanguage: Record<string, string> = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'md': 'markdown',
        'yaml': 'yaml',
        'yml': 'yaml',
        'xml': 'xml',
        'sh': 'shell',
        'bash': 'shell',
        'cs': 'csharp',
        'java': 'java',
        'go': 'go',
        'rb': 'ruby',
        'php': 'php',
        'rs': 'rust',
        'swift': 'swift',
        'c': 'c',
        'cpp': 'cpp',
        'h': 'cpp',
        'hpp': 'cpp',
        'sql': 'sql',
        'kt': 'kotlin',
        'dart': 'dart'
      };
      
      const detectedLanguage = extensionToLanguage[fileExtension] || 'plaintext';
      setEditorLanguage(detectedLanguage);
    }
  }, [language, filePath]);

  // Calculate file statistics when code changes
  useEffect(() => {
    const lines = code.split('\n');
    const lineCount = lines.length;
    const charCount = code.length;
    const wordCount = code.trim().split(/\s+/).filter(Boolean).length;
    
    // Count functions
    let functionCount = 0;
    let classCount = 0;
    let commentCount = 0;

    const functionRegex = /function\s+\w+\s*\([^)]*\)\s*{|=>\s*{|\w+\s*\([^)]*\)\s*{/g;
    const classRegex = /class\s+\w+/g;
    const commentRegex = /\/\/.*$|\/\*[\s\S]*?\*\//gm;

    // Count matches
    functionCount = (code.match(functionRegex) || []).length;
    classCount = (code.match(classRegex) || []).length;
    commentCount = (code.match(commentRegex) || []).length;

    setFileStats({
      lineCount,
      charCount,
      wordCount,
      functionCount,
      classCount,
      commentCount
    });
    
  }, [code]);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Configure editor
    editor.updateOptions({
      readOnly: readOnly,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      },
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      // Highlight the current line
      renderLineHighlight: 'line',
      // Add ruler at column 80
      rulers: [80]
    });
  };

  const toggleTheme = () => {
    setTheme(theme === 'vs-dark' ? 'light' : 'vs-dark');
  };

  // Add styles for code editor
  useEffect(() => {
    if (document && monacoRef.current) {
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        .code-editor-container {
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      `;
      document.head.appendChild(styleElement);
      
      return () => {
        document.head.removeChild(styleElement);
      };
    }
  }, [monacoRef.current]);

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-2 px-2">
        <div className="text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap">
          {filePath}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={toggleTheme}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white py-1 px-2 rounded"
          >
            {theme === 'vs-dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3">
          <div className="h-[500px] border rounded-md overflow-hidden code-editor-container">
            <Editor
              height="100%"
              defaultLanguage={editorLanguage}
              language={editorLanguage}
              value={code}
              theme={theme}
              options={{
                readOnly: readOnly,
                automaticLayout: true,
                wordWrap: 'on'
              }}
              onMount={handleEditorDidMount}
              loading={
                <div className="flex justify-center items-center h-full">
                  <span className="text-gray-500">Loading editor...</span>
                </div>
              }
            />
          </div>
          
          <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
            <div>
              Language: <span className="font-semibold">{editorLanguage}</span>
            </div>
            <div>
              {readOnly ? 'Read only mode' : 'Edit mode'}
            </div>
          </div>
        </div>

        <div className="md:col-span-1">
          <div className="h-full border rounded-md p-4 bg-gray-50 dark:bg-gray-800">
            <h3 className="text-sm font-semibold border-b pb-2 mb-3">File Analytics</h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Lines:</span>
                  <span className="font-medium">{fileStats.lineCount}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-1">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ 
                    width: `${Math.min(100, fileStats.lineCount / 10)}%` 
                  }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Characters:</span>
                  <span className="font-medium">{fileStats.charCount.toLocaleString()}</span>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Words:</span>
                  <span className="font-medium">{fileStats.wordCount.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="pt-2 border-t mt-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Functions:</span>
                  <span className="font-medium">{fileStats.functionCount}</span>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Classes:</span>
                  <span className="font-medium">{fileStats.classCount}</span>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Comments:</span>
                  <span className="font-medium">{fileStats.commentCount}</span>
                </div>
              </div>

              <div className="pt-2 border-t mt-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Code Quality:</span>
                  <span className="font-medium">
                    {fileStats.commentCount > 0 && fileStats.lineCount > 10 ? 'Good' : 'Needs review'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {fileStats.commentCount > 0 
                    ? `Comment ratio: ${(fileStats.commentCount / fileStats.lineCount * 100).toFixed(1)}%` 
                    : 'No comments found'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}