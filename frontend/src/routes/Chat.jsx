import { useState, useEffect, useRef } from "react";
import JsonPanel from "../components/JsonPanel";
import { chatWithAgent, resetAgent } from "../api/agent";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState(null);
  const [schemaId, setSchemaId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message to chat
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await chatWithAgent(input, schemaId);

      // Add agent response to chat
      const assistantMessage = {
        role: "assistant",
        content: response.userMessage,
        action: response.action,
        reasoning: response.reasoning,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update schema if available
      if (response.schema) {
        setSchema(response.schema);
        if (response.schemaId) {
          setSchemaId(response.schemaId);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = {
        role: "assistant",
        content: `Error: ${error.message || "Failed to process message"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetAgent();
      setMessages([]);
      setSchema(null);
      setSchemaId(null);
    } catch (error) {
      console.error("Error resetting agent:", error);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-6rem)] gap-4">
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col border border-gray-200 rounded-lg overflow-hidden">
          {/* Message History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <p className="text-lg font-semibold">Start Your Schema Design</p>
                  <p className="text-sm mt-2">
                    Describe what app you want to build and I'll help design the MongoDB
                    schema.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.role === "user"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-900"
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      {msg.reasoning && (
                        <p className="text-xs mt-1 opacity-70">
                          💭 {msg.reasoning.substring(0, 100)}...
                        </p>
                      )}
                      {msg.action && msg.action !== "NONE" && (
                        <p className="text-xs mt-1 font-semibold opacity-75">
                          Action: {msg.action}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <form onSubmit={handleSendMessage} className="space-y-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your app or ask for refinements..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows="3"
                disabled={loading}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Thinking..." : "Send"}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Schema Panel */}
        <div className="w-1/2 border border-gray-200 rounded-lg overflow-hidden flex flex-col">
          {schema ? (
            <>
              <div className="bg-gray-100 px-4 py-2 border-b">
                <h2 className="font-semibold text-gray-700">MongoDB Schema</h2>
                {schemaId && (
                  <p className="text-xs text-gray-500 mt-1">ID: {schemaId}</p>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                <JsonPanel data={schema} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50 text-gray-400">
              <p>Schema will appear here</p>
            </div>
          )}
        </div>
    </div>
  );
}
