import { useState, useRef } from 'react';

function MessageInput({ onSend, onTyping, onStopTyping }) {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef(null);

  const handleChange = (e) => {
    setMessage(e.target.value);

    // Trigger typing event
    if (onTyping) {
      onTyping();
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (onStopTyping) {
        onStopTyping();
      }
    }, 3000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');

      // Clear typing timeout and emit stop typing
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (onStopTyping) {
        onStopTyping();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-200">
      <div className="flex items-center gap-3">
        {/* Attachment button */}
        <button
          type="button"
          className="p-2 hover:bg-gray-100 rounded-full transition flex-shrink-0"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        {/* Message input */}
        <input
          type="text"
          value={message}
          onChange={handleChange}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full border-0 focus:ring-2 focus:ring-indigo-500 outline-none transition"
        />

        {/* Emoji button */}
        <button
          type="button"
          className="p-2 hover:bg-gray-100 rounded-full transition flex-shrink-0"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Send button */}
        <button
          type="submit"
          disabled={!message.trim()}
          className="p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </form>
  );
}

export default MessageInput;
