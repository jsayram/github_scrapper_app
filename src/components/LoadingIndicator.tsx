import React from 'react';

export interface TutorialProgress {
  stage: string;
  message: string;
  progress: number;
  currentChapter?: number;
  totalChapters?: number;
  chapterName?: string;
}

interface LoadingIndicatorProps {
  type: 'repository' | 'tutorial' | 'architecture';
  isLoading: boolean;
  progress?: TutorialProgress | null;
  documentationMode?: 'tutorial' | 'architecture';
}

// Stage-specific messages for each documentation mode
const stageMessages = {
  tutorial: {
    starting: { title: 'Starting Tutorial Generation...', desc: 'Preparing to analyze your codebase' },
    fetching: { title: 'Fetching Repository...', desc: 'Downloading files from GitHub' },
    identifying: { title: 'Identifying Key Concepts...', desc: 'Analyzing codebase and identifying key concepts' },
    analyzing: { title: 'Analyzing Relationships...', desc: 'Understanding how components connect' },
    ordering: { title: 'Ordering Chapters...', desc: 'Creating the best learning sequence' },
    writing_chapters: { title: 'Writing Tutorial Chapters...', desc: 'Generating detailed explanations' },
    combining: { title: 'Finalizing Tutorial...', desc: 'Combining chapters and creating index' },
    default: { title: 'Creating Tutorial...', desc: 'Analyzing codebase and identifying key concepts...' }
  },
  architecture: {
    starting: { title: 'Starting Architecture Analysis...', desc: 'Preparing to extract project structure' },
    fetching: { title: 'Fetching Repository...', desc: 'Downloading files from GitHub' },
    identifying: { title: 'Extracting Signatures...', desc: 'Analyzing imports, exports, and function signatures' },
    analyzing: { title: 'Mapping Dependencies...', desc: 'Building dependency graph and data flow' },
    ordering: { title: 'Organizing Subsystems...', desc: 'Grouping related components' },
    writing_chapters: { title: 'Generating Architecture Docs...', desc: 'Creating Mermaid diagrams and overviews' },
    combining: { title: 'Finalizing Documentation...', desc: 'Combining sections and generating index' },
    default: { title: 'Creating Architecture Overview...', desc: 'Extracting project structure and relationships...' }
  }
};

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ type, isLoading, progress, documentationMode = 'architecture' }) => {
  if (!isLoading) return null;

  // Repository loading
  if (type === 'repository') {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Tutorial or Architecture generation loading
  const mode = type === 'architecture' ? 'architecture' : documentationMode;
  const messages = stageMessages[mode];
  
  // Get stage-specific message
  const getStageInfo = () => {
    const stage = progress?.stage || 'default';
    if (stage.includes('fetch')) return messages.fetching;
    if (stage.includes('identify') || stage.includes('abstraction')) return messages.identifying;
    if (stage.includes('analyz') || stage.includes('relationship')) return messages.analyzing;
    if (stage.includes('order')) return messages.ordering;
    if (stage.includes('writing') || stage.includes('chapter')) return messages.writing_chapters;
    if (stage.includes('combin') || stage.includes('final')) return messages.combining;
    if (stage.includes('start')) return messages.starting;
    return messages.default;
  };
  
  const stageInfo = getStageInfo();
  const isArchitecture = mode === 'architecture';
  const accentColor = isArchitecture ? 'purple' : 'green';

  return (
    <div className="flex flex-col justify-center items-center py-8 px-6 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6">
      {/* Mode Badge */}
      <div className={`mb-4 px-3 py-1 rounded-full text-xs font-medium ${
        isArchitecture 
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      }`}>
        {isArchitecture ? '🏗️ Architecture Mode' : '📚 Tutorial Mode'}
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-md mb-4">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ease-out ${
              isArchitecture 
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500' 
                : 'bg-gradient-to-r from-green-500 to-blue-500'
            }`}
            style={{ width: `${progress?.progress || 0}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{progress?.progress || 0}%</span>
          <span>100%</span>
        </div>
      </div>
      
      {/* Spinner */}
      <div className={`animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 mb-4 ${
        isArchitecture ? 'border-purple-500' : 'border-green-500'
      }`}></div>
      
      {/* Stage Title */}
      <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
        {stageInfo.title}
      </p>
      
      {/* Progress Message */}
      <p className="text-gray-600 dark:text-gray-300 mt-2 text-center">
        {progress?.message || stageInfo.desc}
      </p>
      
      {/* Architecture-specific: Show what's being extracted */}
      {isArchitecture && progress?.stage?.includes('identify') && (
        <div className="mt-4 px-4 py-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 w-full max-w-md">
          <p className="text-sm text-purple-700 dark:text-purple-300 mb-2 font-medium">
            🔍 Extracting from files:
          </p>
          <ul className="text-xs text-purple-600 dark:text-purple-400 space-y-1">
            <li>• Import/export statements</li>
            <li>• Function & class signatures</li>
            <li>• Interface & type definitions</li>
            <li>• Module dependencies</li>
          </ul>
        </div>
      )}

      {/* Architecture-specific: Show diagram generation */}
      {isArchitecture && progress?.stage?.includes('writing') && (
        <div className="mt-4 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 w-full max-w-md">
          <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-2 font-medium">
            📊 Generating Mermaid diagrams:
          </p>
          <ul className="text-xs text-indigo-600 dark:text-indigo-400 space-y-1">
            <li>• System architecture overview</li>
            <li>• Component relationships</li>
            <li>• Data flow diagrams</li>
            <li>• Dependency graphs</li>
          </ul>
        </div>
      )}
      
      {/* Chapter Progress (for both modes) */}
      {progress?.currentChapter && progress?.totalChapters && (
        <div className={`mt-4 px-4 py-3 bg-white dark:bg-gray-900 rounded-lg border w-full max-w-md ${
          isArchitecture ? 'border-purple-200 dark:border-purple-700' : 'border-gray-200 dark:border-gray-700'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isArchitecture ? 'Section Progress' : 'Chapter Progress'}
            </span>
            <span className={`text-sm font-bold ${
              isArchitecture ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400'
            }`}>
              {progress.currentChapter} / {progress.totalChapters}
            </span>
          </div>
          
          {/* Chapter dots */}
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: progress.totalChapters }, (_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-colors ${
                  i < progress.currentChapter
                    ? isArchitecture ? 'bg-purple-500' : 'bg-green-500'
                    : i === progress.currentChapter - 1
                    ? 'bg-blue-500 animate-pulse'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          
          {/* Current Chapter Name */}
          {progress.chapterName && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate">
              {isArchitecture ? '📐' : '📝'} {progress.chapterName}
            </p>
          )}
        </div>
      )}
      
      {/* Estimated Time */}
      {progress?.totalChapters && progress?.currentChapter && (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          ⏱️ ~{Math.max(1, (progress.totalChapters - progress.currentChapter) * (isArchitecture ? 20 : 30))} seconds remaining
        </p>
      )}
    </div>
  );
};

export default LoadingIndicator;