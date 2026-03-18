import { useRef, useEffect } from 'react';

function MessageList({ messages, isTyping }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <p>No messages yet</p>
          <p className="text-sm mt-1">Send a message to start the conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'} animate-fadeIn`}
        >
          <div
            className={`
              max-w-[70%] px-4 py-2.5 rounded-2xl
              ${message.isOwn
                ? 'bg-indigo-600 text-white rounded-br-md'
                : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
              }
            `}
          >
            <p className="text-[15px] leading-relaxed">{message.content}</p>
            <p
              className={`
                text-xs mt-1
                ${message.isOwn ? 'text-indigo-200' : 'text-gray-400'}
              `}
            >
              {formatTime(message.createdAt)}
            </p>
          </div>
        </div>
      ))}
      {isTyping && (
        <div className="flex justify-start">
          <div className="bg-white text-gray-900 rounded-2xl rounded-bl-md shadow-sm px-4 py-3">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;
