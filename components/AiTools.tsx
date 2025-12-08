import React, { useState, useEffect } from 'react';
import { Transaction, FoundItem, MatchedItemPair } from '../types';
import { callOpenRouter, parseStatementWithAI, analyzeTransactionsWithAI } from '../services/openRouterService';

interface AiToolsProps {
  sheetDbUrl: string;
  onAddTransaction: (transaction: Transaction) => void;
  transactions: Transaction[];
  foundTransactions: FoundItem[];
  setFoundTransactions: (items: FoundItem[]) => void;
  matchedItems: MatchedItemPair[];
  setMatchedItems: (items: MatchedItemPair[]) => void;
  incomeCategories: string[];
  expenseCategories: string[];
  investmentCategories: string[];
  onShowNotification: (message: string) => void;
  isSelectModeActive: boolean;
  onToggleSelectMode: (active: boolean) => void;
}

const AiTools: React.FC<AiToolsProps> = ({
  sheetDbUrl,
  onAddTransaction,
  transactions,
  foundTransactions,
  setFoundTransactions,
  matchedItems,
  setMatchedItems,
  incomeCategories,
  expenseCategories,
  investmentCategories,
  onShowNotification,
  isSelectModeActive,
  onToggleSelectMode
}) => {
  const [aiQuery, setAiQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiInsights, setAiInsights] = useState('');
  const [statementText, setStatementText] = useState('');

  // Analyze transactions with AI
  const handleAnalyzeTransactions = async () => {
    if (transactions.length === 0) {
      onShowNotification('No transactions to analyze');
      return;
    }

    setIsProcessing(true);
    try {
      const transactionsText = transactions
        .slice(0, 50) // Limit to recent 50 transactions
        .map(t => `${t.date}: ${t.category} - $${t.amount}${t.note ? ` (${t.note})` : ''}`)
        .join('\n');

      const insights = await analyzeTransactionsWithAI(transactionsText, {
        incomeCategories,
        expenseCategories,
        investmentCategories
      });
      
      setAiInsights(insights);
      onShowNotification('Analysis complete');
    } catch (error) {
      console.error('AI analysis failed:', error);
      onShowNotification('AI analysis failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Parse bank statement
  const handleParseStatement = async () => {
    if (!statementText.trim()) {
      onShowNotification('Please paste statement text');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await parseStatementWithAI(statementText);
      
      // Parse the JSON response
      const parsed = JSON.parse(response);
      
      if (parsed.transactions && Array.isArray(parsed.transactions)) {
        const foundItems: FoundItem[] = parsed.transactions.map((tx: any, index: number) => ({
          id: `ai-${Date.now()}-${index}`,
          date: tx.date,
          amount: tx.amount,
          category: tx.category,
          note: tx.note,
          type: tx.type,
          source: 'PDF file'
        }));
        
        setFoundTransactions(foundItems);
        onShowNotification(`Found ${foundItems.length} transactions`);
        setStatementText('');
      }
    } catch (error) {
      console.error('Statement parsing failed:', error);
      onShowNotification('Failed to parse statement');
    } finally {
      setIsProcessing(false);
    }
  };

  // Ask custom question
  const handleAskQuestion = async () => {
    if (!aiQuery.trim()) {
      onShowNotification('Please enter a question');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await callOpenRouter([
        { role: 'system', content: 'You are a financial advisor helping with expense tracking.' },
        { role: 'user', content: `Context: I have ${transactions.length} transactions in my expense tracker. ${aiQuery}` }
      ]);
      
      setAiInsights(response.choices[0].message.content);
      onShowNotification('Answer received');
      setAiQuery('');
    } catch (error) {
      console.error('AI query failed:', error);
      onShowNotification('Failed to get answer');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">AI Financial Analysis</h2>
        
        <div className="space-y-4">
          <button
            onClick={handleAnalyzeTransactions}
            disabled={isProcessing || transactions.length === 0}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? 'Analyzing...' : 'Analyze Transactions with AI'}
          </button>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Ask AI a Question
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="e.g., How can I reduce my dining expenses?"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
              />
              <button
                onClick={handleAskQuestion}
                disabled={isProcessing}
                className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Ask
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Parse Bank Statement
            </label>
            <textarea
              value={statementText}
              onChange={(e) => setStatementText(e.target.value)}
              placeholder="Paste your bank statement text here..."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleParseStatement}
              disabled={isProcessing || !statementText.trim()}
              className="w-full bg-purple-600 text-white py-3 rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? 'Parsing...' : 'Parse Statement with AI'}
            </button>
          </div>
        </div>
      </div>

      {aiInsights && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-3">AI Insights</h3>
          <div className="prose max-w-none text-gray-700">
            {aiInsights.split('\n').map((line, index) => (
              <p key={index} className="mb-2">{line}</p>
            ))}
          </div>
          <button
            onClick={() => setAiInsights('')}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700"
          >
            Clear insights
          </button>
        </div>
      )}

      {foundTransactions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-3">AI-Extracted Transactions</h3>
          <div className="space-y-3">
            {foundTransactions.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{item.category}</p>
                    <p className="text-sm text-gray-600">{item.date} • {item.note}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${(item.amount || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${Math.abs(item.amount || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{item.type}</p>
                  </div>
                </div>
                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={() => {
                      if (item.date && item.amount && item.category) {
                        onAddTransaction({
                          id: `manual-${Date.now()}`,
                          date: item.date,
                          amount: item.amount,
                          category: item.category,
                          note: item.note,
                          type: item.type as any
                        });
                        setFoundTransactions(foundTransactions.filter(f => f.id !== item.id));
                        onShowNotification('Transaction added');
                      }
                    }}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Add to Tracker
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AiTools;
