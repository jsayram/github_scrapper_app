import React from 'react';

interface ErrorMessageProps {
  message: string;
  /** Callback when user wants to retry with reduced content */
  onRetryWithReduction?: () => void;
  /** Callback when user wants to change model */
  onModelChange?: (providerId: string, modelId: string) => void;
}

// Model suggestions for token limit errors
const LARGER_MODELS = [
  { providerId: 'google', modelId: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1000000 },
  { providerId: 'google', modelId: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 2000000 },
  { providerId: 'anthropic', modelId: 'claude-sonnet-4-5', name: 'Claude 4.5 Sonnet', contextWindow: 200000 },
  { providerId: 'openai', modelId: 'gpt-5', name: 'GPT-5', contextWindow: 200000 },
];

const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  message, 
  onRetryWithReduction,
  onModelChange,
}) => {
  if (!message) return null;
  
  // Check if this is a rate limit error (contains the detailed instructions)
  const isRateLimitError = message.includes('rate limit') && message.includes('GitHub');
  
  // Check if this is an authentication error
  const isAuthError = message.includes('authentication failed') || message.includes('Bad credentials') || message.includes('Invalid or expired token');
  
  // Check if this is a token limit error
  const isTokenLimitError = message.includes('🚨') && (
    message.includes('Token limit') || 
    message.includes('token') && message.includes('limit') ||
    message.includes('exceed') && message.includes('token')
  );
  
  // Function to convert URLs in text to clickable links
  const renderWithLinks = (text: string) => {
    const urlRegex = /(https:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };
  
  // Token limit error - special handling with recovery options
  if (isTokenLimitError) {
    // Parse token numbers from error message
    const limitMatch = message.match(/Limit:\s*([\d,]+)/i);
    const inputMatch = message.match(/Input:\s*([\d,]+)/i);
    
    const limitTokens = limitMatch ? parseInt(limitMatch[1].replace(/,/g, ''), 10) : null;
    const inputTokens = inputMatch ? parseInt(inputMatch[1].replace(/,/g, ''), 10) : null;
    
    // Calculate reduction needed
    const reductionPercent = limitTokens && inputTokens 
      ? Math.ceil(((inputTokens - limitTokens) / inputTokens) * 100)
      : null;
    
    // Filter suggestions to show larger models than current
    const suggestions = LARGER_MODELS.filter(m => 
      inputTokens ? m.contextWindow > inputTokens : m.contextWindow > (limitTokens || 200000)
    );
    
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg mb-6 overflow-hidden">
        {/* Main error header */}
        <div className="bg-red-100 dark:bg-red-900/40 px-4 py-3 border-b border-red-200 dark:border-red-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚨</span>
            <p className="text-red-800 dark:text-red-200 font-semibold">Token Limit Exceeded</p>
          </div>
        </div>
        
        {/* Error details */}
        <div className="px-4 py-4 text-sm">
          <p className="text-red-700 dark:text-red-300 mb-3">{message}</p>
          
          {limitTokens && inputTokens && (
            <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-3 mb-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-red-600 dark:text-red-400">Requested:</span>
                  <span className="font-mono font-bold ml-2">{inputTokens.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-red-600 dark:text-red-400">Limit:</span>
                  <span className="font-mono font-bold ml-2">{limitTokens.toLocaleString()}</span>
                </div>
              </div>
              {reductionPercent && (
                <p className="mt-2 text-red-600 dark:text-red-400">
                  You need to reduce content by approximately <strong>{reductionPercent}%</strong>
                </p>
              )}
            </div>
          )}
          
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            <strong>How to fix this:</strong>
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1 mb-4">
            <li>Select fewer files for the tutorial</li>
            <li>Remove large files (tests, generated code, etc.)</li>
            <li>Use a model with a larger context window</li>
          </ul>
        </div>
        
        {/* Actions */}
        <div className="px-4 py-3 bg-red-100/50 dark:bg-red-900/30 border-t border-red-200 dark:border-red-700 space-y-3">
          {onRetryWithReduction && (
            <button
              onClick={onRetryWithReduction}
              className="w-full px-4 py-2 bg-orange-500 text-white font-medium rounded-md hover:bg-orange-600 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <span>🔄</span>
              Auto-reduce content & retry
            </button>
          )}
          
          {onModelChange && suggestions.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Or switch to a larger model:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={`${s.providerId}-${s.modelId}`}
                    onClick={() => onModelChange(s.providerId, s.modelId)}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    {s.name} ({(s.contextWindow / 1000000).toFixed(1)}M tokens)
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  if (isRateLimitError || isAuthError) {
    // Parse the structured error message
    const lines = message.split('\n');
    const mainError = lines[0]; // First line is the main error
    const details = lines.slice(1).join('\n'); // Rest is the detailed help
    
    const icon = isAuthError ? '🔐' : '⚠️';
    const buttonText = isAuthError ? 'Manage GitHub Tokens' : 'Create GitHub Token';
    
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg mb-6 overflow-hidden">
        {/* Main error header */}
        <div className="bg-red-100 dark:bg-red-900/40 px-4 py-3 border-b border-red-200 dark:border-red-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <p className="text-red-800 dark:text-red-200 font-semibold">{mainError}</p>
          </div>
        </div>
        
        {/* Detailed help section */}
        <div className="px-4 py-4 text-sm">
          <pre className="whitespace-pre-wrap font-sans text-red-700 dark:text-red-300 leading-relaxed">
            {renderWithLinks(details)}
          </pre>
        </div>
        
        {/* Quick action button */}
        <div className="px-4 py-3 bg-red-100/50 dark:bg-red-900/30 border-t border-red-200 dark:border-red-700">
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            {buttonText}
          </a>
        </div>
      </div>
    );
  }
  
  // Default error display
  return (
    <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
      <div className="flex items-start gap-2">
        <span className="text-xl">❌</span>
        <p className="whitespace-pre-wrap">{renderWithLinks(message)}</p>
      </div>
    </div>
  );
};

export default ErrorMessage;