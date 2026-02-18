import { useState, useEffect, useRef } from "react";
import JsonPanel from "../components/JsonPanel";
import { chatWithAgent, resetAgent } from "../api/agent";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState(null);
  const [schemaId, setSchemaId] = useState(null);
  const [showForm, setShowForm] = useState(true);
  const [formInput, setFormInput] = useState("");
  const [workloadType, setWorkloadType] = useState("balanced");
  const [activeTab, setActiveTab] = useState("schema");
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

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formInput.trim()) return;

    // Hide form and send initial message with workload type
    setShowForm(false);
    const message = `${formInput}\n\nWorkload Type: ${workloadType}`;
    
    // Add user message to chat
    const userMessage = { role: "user", content: formInput };
    setMessages((prev) => [...prev, userMessage]);
    setFormInput("");
    setLoading(true);

    try {
      const response = await chatWithAgent(message, schemaId);

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
      setShowForm(true);
      setFormInput("");
      setWorkloadType("balanced");
      setActiveTab("schema");
    } catch (error) {
      console.error("Error resetting agent:", error);
    }
  };

  return (
    <div className="min-h-[calc(100vh-6rem)]">
        {/* Full Page Form */}
        {showForm && (
          <div className="flex items-center justify-center h-full p-6 bg-gray-50">
            <form onSubmit={handleFormSubmit} className="w-full max-w-2xl space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Generate MongoDB Schema</h1>
                <p className="text-gray-600">Describe your application requirements and I'll design the optimal schema</p>
              </div>
              
              <div className="data-card p-6 space-y-6">
                <div>
                  <label htmlFor="requirements" className="block text-sm font-semibold text-gray-700 mb-3">
                    What's your app about?
                  </label>
                  <textarea
                    id="requirements"
                    value={formInput}
                    onChange={(e) => setFormInput(e.target.value)}
                    placeholder="e.g., An e-commerce platform with products sold in multiple stores at different prices, or a school management system with students, teachers, classes..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows="6"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="workload" className="block text-sm font-semibold text-gray-700 mb-3">
                    What's your workload pattern?
                  </label>
                  <select
                    id="workload"
                    value={workloadType}
                    onChange={(e) => setWorkloadType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  >
                    <option value="balanced">Balanced</option>
                    <option value="read-heavy">Read-Heavy (lots of reads, few writes)</option>
                    <option value="write-heavy">Write-Heavy (lots of writes)</option>
                    <option value="analytical">Analytical (OLAP, reporting)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    This helps optimize your schema for your specific access patterns
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !formInput.trim()}
                  className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {loading ? "Generating Schema..." : "Generate Schema"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Split Layout: Chat + Schema */}
        {!showForm && (
          <div className="flex min-h-[calc(100vh-6rem)] h-[calc(100vh-6rem)] gap-4 p-4">
            {/* Chat Panel */}
            <div className="flex-1 flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white">
              {/* Message History */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 min-h-0">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <p className="text-lg font-semibold">Start Your Schema Design</p>
                    <p className="text-sm mt-2">
                      Describe what app you want to build and I'll help design the MongoDB schema.
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
            <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
              <form onSubmit={handleSendMessage} className="space-y-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your refinements or ask questions..."
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

            {/* Schema Panel - Only show in split view */}
            {schema && (
            <div className="flex-1 max-w-md border border-gray-200 rounded-lg overflow-hidden flex flex-col bg-white h-full">
          {schema ? (
            <>
              <div className="bg-gray-100 px-4 py-2 border-b flex-shrink-0">
                <h2 className="font-semibold text-gray-700">MongoDB Schema</h2>
                {schemaId && (
                  <p className="text-xs text-gray-500 mt-1">ID: {schemaId}</p>
                )}
              </div>

            {/* Tabs */}
            <div className="flex border-b bg-gray-50 flex-shrink-0 overflow-x-auto">
              {[
                { id: "schema", label: "Schema" },
                { id: "decisions", label: "Decisions" },
                { id: "relationships", label: "Relationships" },
                { id: "explanations", label: "Explanations" },
                { id: "warnings", label: "Warnings" },
                { id: "indexes", label: "Indexes" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition ${
                    activeTab === tab.id
                      ? "border-b-2 border-blue-500 text-blue-600 bg-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-white">
              {activeTab === "schema" && (
                <div>
                  <h3 className="text-xs font-bold text-gray-700 mb-2">Collections</h3>
                  <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-auto max-h-96">
                    {JSON.stringify(schema.schema, null, 2)}
                  </pre>
                </div>
              )}

            {activeTab === "decisions" && (
                <div>
                  <h3 className="text-xs font-bold text-gray-700 mb-2">Field Design Decisions (Embed vs Reference)</h3>
                  {schema.decisions && Object.keys(schema.decisions).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(schema.decisions)
                        .filter(([key]) => key !== "relationships")
                        .map(([collection, decision]) => (
                          <div key={collection} className="bg-green-50 p-2 rounded border border-green-200">
                            <p className="text-xs font-semibold text-green-900">{collection}</p>
                            <p className="text-xs text-green-800 mt-1">{decision}</p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">No decisions yet</p>
                  )}
                </div>
              )}

              {activeTab === "relationships" && (
                <div>
                  <h3 className="text-xs font-bold text-gray-700 mb-2">Collection Relationships</h3>
                  {schema.relationships && Object.keys(schema.relationships).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(schema.relationships).map(([rel, pattern]) => (
                        <div key={rel} className="bg-purple-50 p-2 rounded border border-purple-200">
                          <p className="text-xs font-semibold text-purple-900">{rel}</p>
                          <p className="text-xs text-purple-800 mt-1">{pattern}</p>
                        </div>
                      ))}
                    </div>
                  ) : schema.decisions && schema.decisions.relationships && Object.keys(schema.decisions.relationships).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(schema.decisions.relationships).map(([rel, pattern]) => (
                        <div key={rel} className="bg-purple-50 p-2 rounded border border-purple-200">
                          <p className="text-xs font-semibold text-purple-900">{rel}</p>
                          <p className="text-xs text-purple-800 mt-1">{pattern}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">No relationships found</p>
                  )}
                </div>
              )}

              {activeTab === "explanations" && (
                <div>
                  <h3 className="text-xs font-bold text-gray-700 mb-2">Design Explanations</h3>
                  {schema.explanations && Object.keys(schema.explanations).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(schema.explanations).map(([key, explanation]) => (
                        <div key={key} className="bg-blue-50 p-2 rounded border border-blue-200">
                          <p className="text-xs font-semibold text-blue-900">{key}</p>
                          <p className="text-xs text-blue-800 mt-1">{explanation}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">No explanations yet</p>
                  )}
                </div>
              )}

              {activeTab === "warnings" && (
                <div>
                  <h3 className="text-xs font-bold text-gray-700 mb-2">Warnings & Concerns</h3>
                  {schema.warnings && schema.warnings.length > 0 ? (
                    <div className="space-y-2">
                      {schema.warnings.map((warning, idx) => (
                        <div key={idx} className="bg-yellow-50 p-2 rounded border border-yellow-200">
                          <p className="text-xs text-yellow-900">⚠️ {warning}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">No warnings detected</p>
                  )}
                </div>
              )}

              {activeTab === "indexes" && (
                <div>
                  <h3 className="text-xs font-bold text-gray-700 mb-2">Recommended Indexes</h3>
                  {schema.indexes && schema.indexes.length > 0 ? (
                    <div className="space-y-2">
                      {schema.indexes.map((index, idx) => (
                        <div key={idx} className="bg-indigo-50 p-2 rounded border border-indigo-200">
                          <p className="text-xs font-semibold text-indigo-900">
                            {index.collection}
                          </p>
                          <p className="text-xs text-indigo-800 mt-1">
                            {Array.isArray(index.fields) 
                              ? `Fields: ${index.fields.join(", ")}`
                              : `Field: ${index.field || index.fields}`
                            }
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">No indexes recommended</p>
                  )}
                </div>
              )}
            </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50 text-gray-400">
              <div className="text-center">
                <p className="text-sm font-semibold">Schema will appear here</p>
                <p className="text-xs mt-1">Generate a schema to see:</p>
                <ul className="text-xs mt-2 space-y-1">
                  <li>• MongoDB collections</li>
                  <li>• Embed vs Reference decisions</li>
                  <li>• Design explanations</li>
                  <li>• Warnings & best practices</li>
                  <li>• Recommended indexes</li>
                </ul>
              </div>
            </div>
            )}
            </div>
            )}
          </div>
        )}
    </div>
  );
}
