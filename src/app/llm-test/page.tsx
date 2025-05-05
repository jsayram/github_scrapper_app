'use client';

import { useState } from 'react';
import { useLLM } from '@/components/LlmService';

export default function LlmTestPage() {
  const [prompt, setPrompt] = useState('');
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  
  // Using the useLLM hook for client-side functionality
  const { callOpenAI, loading, response, error } = useLLM();

  // Handle the form submission using the hook
  const handleHookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    try {
      await callOpenAI(prompt);
    } catch (err) {
      console.error('Error with LLM hook:', err);
    }
  };

  // Handle the form submission using the API endpoint
  const handleApiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setApiLoading(true);
    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setApiResponse(data.result);
    } catch (err) {
      console.error('Error with LLM API:', err);
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">LLM Integration Test</h1>
      
      <div className="mb-6">
        <label htmlFor="prompt" className="block mb-2 text-lg font-medium">Enter a prompt:</label>
        <textarea
          id="prompt"
          className="w-full p-3 border border-gray-300 rounded-lg min-h-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here..."
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-3">Test with React Hook</h2>
          <button
            onClick={handleHookSubmit}
            disabled={loading || !prompt}
            className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:opacity-50 mb-4 hover:bg-blue-600 active:bg-blue-700 transition-colors w-full"
          >
            {loading ? 'Processing...' : 'Submit with Hook'}
          </button>
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md mb-4">
              <p className="font-medium mb-1">Error:</p>
              <p>{error}</p>
            </div>
          )}
          
          {response && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
              <h3 className="font-medium mb-2 text-blue-700">Response:</h3>
              <div className="whitespace-pre-wrap bg-white p-3 rounded border text-gray-800 font-medium shadow-inner">
                {response}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-3">Test with API Endpoint</h2>
          <button
            onClick={handleApiSubmit}
            disabled={apiLoading || !prompt}
            className="px-4 py-2 bg-green-500 text-white rounded-md disabled:opacity-50 mb-4 hover:bg-green-600 active:bg-green-700 transition-colors w-full"
          >
            {apiLoading ? 'Processing...' : 'Submit with API'}
          </button>
          
          {apiResponse && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
              <h3 className="font-medium mb-2 text-green-700">Response:</h3>
              <div className="whitespace-pre-wrap bg-white p-3 rounded border text-gray-800 font-medium shadow-inner">
                {apiResponse}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-5 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium mb-3 text-yellow-800">How This Works:</h3>
        <p className="mb-3">This page demonstrates two ways to use the LLM service:</p>
        <ol className="list-decimal ml-6 space-y-2">
          <li className="pl-1">Using the <code className="bg-gray-100 px-2 py-0.5 rounded">useLLM</code> React hook directly in your component</li>
          <li className="pl-1">Calling the <code className="bg-gray-100 px-2 py-0.5 rounded">api/llm</code> API endpoint from your client code</li>
        </ol>
        <p className="mt-3 text-sm text-gray-700">
          Both methods are using the same underlying <code className="bg-gray-100 px-2 py-0.5 rounded">callLLM</code> function with caching and logging.
        </p>
      </div>
    </div>
  );
}