import { MessageSquare } from 'lucide-react';
import { Button } from './ui/button';

interface QSChatBubbleProps {
  onClick: () => void;
}

const QSChatBubble = ({ onClick }: QSChatBubbleProps) => {
  return (
    <Button
      onClick={onClick}
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform z-50 bg-primary hover:bg-primary/90"
      aria-label="Ask the QS"
    >
      <MessageSquare className="h-6 w-6" />
    </Button>
  );
};

export default QSChatBubble;
