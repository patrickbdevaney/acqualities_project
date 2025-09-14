'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; // for math rendering

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string; };

interface MapControllerProps { position: [number, number]; zoom?: number; }

const MapController: React.FC<MapControllerProps> = ({ position, zoom }) => {
  const map = useMap();
  if (zoom) map.setView(position, zoom);
  return null;
};

// Custom components for better rendering
const MarkdownComponents = {
  // Enhanced table rendering
  table: ({ children, ...props }: any) => (
    <div className="overflow-x-auto my-4">
      <table
        className="min-w-full divide-y divide-gray-200 border border-gray-300 rounded-lg shadow-sm"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: any) => (
    <thead className="bg-gray-50" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }: any) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: any) => (
    <td
      className="px-4 py-3 text-sm text-gray-900 border-b border-gray-100 whitespace-nowrap"
      {...props}
    >
      {children}
    </td>
  ),
  tbody: ({ children, ...props }: any) => (
    <tbody className="bg-white divide-y divide-gray-100" {...props}>
      {children}
    </tbody>
  ),
  // Enhanced list rendering
  ul: ({ children, ...props }: any) => (
    <ul className="list-disc list-inside space-y-1 my-3 ml-4" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="list-decimal list-inside space-y-1 my-3 ml-4" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="text-gray-800 leading-relaxed" {...props}>
      {children}
    </li>
  ),
  // Enhanced headings
  h1: ({ children, ...props }: any) => (
    <h1 className="text-2xl font-bold text-gray-900 mb-4 mt-6 border-b border-gray-200 pb-2" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-xl font-semibold text-gray-800 mb-3 mt-5" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-lg font-medium text-gray-800 mb-2 mt-4" {...props}>
      {children}
    </h3>
  ),
  // Enhanced code blocks
  code: ({ inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    return !inline ? (
      <div className="relative">
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 text-sm">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    ) : (
      <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    );
  },
  // Enhanced blockquotes
  blockquote: ({ children, ...props }: any) => (
    <blockquote
      className="border-l-4 border-teal-500 pl-4 py-2 my-4 bg-gray-50 italic text-gray-700 rounded-r-lg"
      {...props}
    >
      {children}
    </blockquote>
  ),
  // Enhanced paragraphs
  p: ({ children, ...props }: any) => (
    <p className="text-gray-800 leading-relaxed mb-3" {...props}>
      {children}
    </p>
  ),
  // Enhanced links
  a: ({ children, href, ...props }: any) => (
    <a
      href={href}
      className="text-teal-600 hover:text-teal-800 underline decoration-teal-300 hover:decoration-teal-500 transition-colors duration-200"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  // Enhanced horizontal rules
  hr: (props: any) => (
    <hr className="my-6 border-t border-gray-300" {...props} />
  ),
};

export default function Page() {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<{ lat: number; lon: number; insights: string } | null>(null);
  const [position, setPosition] = useState<[number, number]>([25.7617, -80.1918]);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const southFloridaBounds: [number, number][] = [[24.5, -80.5], [26.7, -79.8]];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isLoading]);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setIsLoading(true);

    const userMsg: ChatMessage = { role: 'user', content: message };
    setHistory(prev => [...prev, userMsg]);
    setMessage('');

    const assistantIndex = history.length + 1;
    setHistory(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, sessionId })
      });

      if (!res.ok) throw new Error(`API request failed with status ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullResponse = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value || new Uint8Array());
        fullResponse += chunk;

        setHistory(prev => {
          const newHist = [...prev];
          const existing = newHist[assistantIndex];
          newHist[assistantIndex] = { ...existing, content: existing.content + chunk };
          return newHist;
        });
      }

      // Try to parse the complete response for location data
      try {
        const lines = fullResponse.split('\n');
        const jsonLine = lines.find(line => line.startsWith('{"parsed":'));

        if (jsonLine) {
          const data = JSON.parse(jsonLine);
          if (data?.parsed?.location) {
            const loc = data.parsed.location;
            setPosition([loc.lat, loc.lon]);
            setSelectedNeighborhood({
              lat: loc.lat,
              lon: loc.lon,
              insights: data.parsed.response
            });

            // Update the chat history to show only the clean response
            setHistory(prev => {
              const newHist = [...prev];
              newHist[assistantIndex] = {
                ...newHist[assistantIndex],
                content: data.parsed.response
              };
              return newHist;
            });
          }
        }
      } catch (parseError) {
        console.log('No JSON data found in response, showing raw content');
        // If there's no JSON, just show the streamed content as-is
      }

    } catch (error) {
      console.error('❌ Client error:', error);
      setHistory(prev => {
        const newHist = [...prev];
        newHist[assistantIndex] = {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.'
        };
        return newHist;
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-teal-100 flex flex-col items-center p-4 sm:p-6">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-teal-800 tracking-tight">AquaQual Chat</h1>
        <p className="text-lg text-gray-600 mt-2">Explore South Florida's climate risks with AI-powered insights</p>
      </header>

      <div className="w-full max-w-6xl flex flex-col gap-6">
        {/* Map Section */}
        <div className="w-full h-[50vh] rounded-xl overflow-hidden shadow-lg border-2 border-gray-200">
          <MapContainer center={position} zoom={11} bounds={southFloridaBounds} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
            {selectedNeighborhood && (
              <>
                <Marker position={[selectedNeighborhood.lat, selectedNeighborhood.lon]} />
                <MapController position={[selectedNeighborhood.lat, selectedNeighborhood.lon]} zoom={14} />
              </>
            )}
          </MapContainer>
        </div>

        {/* Chat Section */}
        <div className="bg-white rounded-xl shadow-lg flex flex-col min-h-[12rem] max-h-[60vh] transition-all duration-300">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {history.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] p-4 rounded-lg shadow-sm transition-all duration-200 ${msg.role === 'user'
                    ? 'bg-teal-600 text-white'
                    : msg.role === 'system'
                      ? 'bg-yellow-100 text-gray-800 italic'
                      : 'bg-gray-50 text-gray-800 border border-gray-200'
                  }`}>
                  <div className="markdown-content max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                      rehypePlugins={[rehypeRaw, rehypeSlug, rehypeKatex]}
                      components={MarkdownComponents}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                  <div className="text-center text-gray-500 animate-pulse">Analyzing...</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 p-4 border-t border-gray-200">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g., What's the flood risk in Brickell?"
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all duration-200"
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 transition-all duration-200"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}