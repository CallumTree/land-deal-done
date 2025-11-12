import { useState, useRef, useEffect } from 'react';
import { X, Send, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { useQSChat } from '@/hooks/useQSChat';
import { Project } from '@/types/project';
import { useToast } from './ui/use-toast';

interface QSChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onSaveToNotes?: (notes: string) => void;
}

const QSChatPanel = ({ isOpen, onClose, project, onSaveToNotes }: QSChatPanelProps) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { messages, isLoading, error, sendMessage, exportToNotes } = useQSChat(project);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const messageToSend = input;
    setInput('');
    await sendMessage(messageToSend);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveToNotes = () => {
    const chatExport = exportToNotes();
    if (onSaveToNotes) {
      onSaveToNotes(chatExport);
      toast({
        title: 'Chat saved',
        description: 'Conversation added to project notes',
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(chatExport);
      toast({
        title: 'Chat copied',
        description: 'Conversation copied to clipboard',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end md:items-stretch md:justify-end pointer-events-none">
      {/* Backdrop for mobile */}
      <div 
        className="absolute inset-0 bg-black/50 md:hidden pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Chat panel */}
      <div className="w-full md:w-96 h-[80vh] md:h-full bg-background border-l shadow-2xl flex flex-col pointer-events-auto rounded-t-xl md:rounded-none">
        {/* Header */}
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Ask the QS</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {project && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="font-medium text-foreground">{project.name}</p>
              <div className="flex gap-3 flex-wrap">
                <span>{project.location}</span>
                <span>GDV: £{project.gdv?.toLocaleString()}</span>
                <span>Margin: {project.profitMargin?.toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm mb-2 text-[#F5F5F7]">👋 Hello! I'm your On-Hand QS.</p>
                <p className="text-xs text-[#C7C7CC]">Ask me anything about feasibility, costing, ROI, or development advice.</p>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-[#252528] text-[#F5F5F7]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#252528] text-[#F5F5F7] rounded-lg px-3 py-2 text-sm">
                  <div className="flex gap-1">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce [animation-delay:0.2s]">●</span>
                    <span className="animate-bounce [animation-delay:0.4s]">●</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
                {error}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex gap-2 mb-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about costs, ROI, feasibility..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleSend} 
              disabled={isLoading || !input.trim()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Powered by BuildFlow AI</span>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveToNotes}
                className="h-6 text-xs"
              >
                <Download className="h-3 w-3 mr-1" />
                Save to Notes
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QSChatPanel;
