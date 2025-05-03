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

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Configure editor
    editor.updateOptions({
      readOnly: readOnly,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all',
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      }
    });
  };

  const toggleTheme = () => {
    setTheme(theme === 'vs-dark' ? 'light' : 'vs-dark');
  };

  return (
    <div className="flex flex-col h-full">
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
      
      <div className="h-[500px] border rounded-md overflow-hidden">
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
          Language: {editorLanguage}
        </div>
        <div>
          {readOnly ? 'Read only mode' : 'Edit mode'}
        </div>
      </div>
    </div>
  );
}