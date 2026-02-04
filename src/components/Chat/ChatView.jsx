import { useState, useEffect, useRef } from 'react'
import { Send, RotateCcw, Loader } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useMessages } from '../../hooks/useMessages'
import { useItems } from '../../hooks/useItems'
import { analyzeWithAI } from '../../lib/ai'

const ChatView = () => {
  const { profile } = useAuth()
  const { messages, addMessage, clearMessages } = useMessages()
  const { items, addItems } = useItems()
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)

  const currentHour = new Date().getHours()
  const inSignalWindow = currentHour < 13

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return

    const userMessage = input.trim()
    setInput('')
    setError('')

    // Add user message to chat
    await addMessage('user', userMessage)

    try {
      setIsProcessing(true)
      
      const result = await analyzeWithAI(userMessage, profile, items)
      
      // Add AI response to chat
      await addMessage('assistant', result.response)
      
      // Add extracted items
      if (result.items && result.items.length > 0) {
        await addItems(result.items)
      }
    } catch (err) {
      console.error('Chat error:', err)
      setError('Failed to get response. Please try again.')
      await addMessage('assistant', "Sorry, I'm having trouble connecting right now. Please try again in a moment.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClearChat = () => {
    if (window.confirm('Clear chat history? Your list items will be kept.')) {
      clearMessages()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Signal Window Indicator */}
      <div className={`mx-4 mt-4 rounded-lg p-3 ${
        inSignalWindow 
          ? 'bg-green-900/50 border border-green-700' 
          : 'bg-yellow-900/50 border border-yellow-700'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${inSignalWindow ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
          <span className={`text-sm font-medium ${inSignalWindow ? 'text-green-300' : 'text-yellow-300'}`}>
            {inSignalWindow ? 'SIGNAL WINDOW' : 'NOISE MODE'}
          </span>
          <span className={`text-xs ml-auto ${inSignalWindow ? 'text-green-400/70' : 'text-yellow-400/70'}`}>
            {inSignalWindow ? 'Execute your top 3-5' : 'Bezos Rule: No major decisions'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl ${
              msg.role === 'user'
                ? 'bg-blue-600 rounded-br-md'
                : 'bg-slate-800 rounded-bl-md'
            }`}>
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-3 rounded-2xl rounded-bl-md">
              <Loader className="animate-spin" size={20} />
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-900/50 border border-red-700 px-4 py-2 rounded-lg text-sm text-red-300">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <button
            onClick={handleClearChat}
            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl"
            title="Clear chat"
          >
            <RotateCcw size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Dump what's on your mind..."
            className="flex-1 p-3 bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim()}
            className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatView
