'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { PlusIcon, EllipsisVerticalIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ChatBubbleLeftIcon } from '@heroicons/react/24/solid';

interface ChatSession {
  id: string;
  title: string;
  createdAt: any;
  updatedAt: any;
  messageCount?: number;
}

interface ChatSidebarProps {
  activeChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
}

export default function ChatSidebar({ activeChatId, onChatSelect, onNewChat }: ChatSidebarProps) {
  const { user } = useAuth();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Load chat sessions from Firestore
  useEffect(() => {
    if (!user?.uid) return;

    const chatsRef = collection(db, 'conversations', user.uid, 'chats');
    const q = query(chatsRef, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions: ChatSession[] = [];
      snapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data()
        } as ChatSession);
      });
      setChatSessions(sessions);
      setLoading(false);
    }, (error) => {
      console.error('Error loading chat sessions:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleNewChat = async () => {
    if (!user?.uid) return;

    try {
      const chatsRef = collection(db, 'conversations', user.uid, 'chats');
      const newChatDoc = await addDoc(chatsRef, {
        title: 'New Chat',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        messageCount: 0
      });
      
      onNewChat();
      onChatSelect(newChatDoc.id);
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  const handleRename = async (chatId: string, newTitle: string) => {
    if (!user?.uid || !newTitle.trim()) return;

    try {
      const chatRef = doc(db, 'conversations', user.uid, 'chats', chatId);
      await updateDoc(chatRef, {
        title: newTitle.trim(),
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
      setEditTitle('');
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  };

  const handleDelete = async (chatId: string) => {
    if (!user?.uid) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this chat? This action cannot be undone.');
    if (!confirmed) return;

    try {
      // Delete the chat document
      const chatRef = doc(db, 'conversations', user.uid, 'chats', chatId);
      await deleteDoc(chatRef);

      // TODO: Also delete associated messages and cleanup pipelines/exports
      // This would require additional cleanup logic

      // If this was the active chat, select the first remaining chat or create new
      if (activeChatId === chatId) {
        const remainingSessions = chatSessions.filter(s => s.id !== chatId);
        if (remainingSessions.length > 0) {
          onChatSelect(remainingSessions[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const startEditing = (chat: ChatSession) => {
    setEditingId(chat.id);
    setEditTitle(chat.title);
    setMenuOpenId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle('');
  };

  if (loading) {
    return (
      <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Chat Sessions List */}
      <div className="flex-1 overflow-y-auto p-2">
        {chatSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <ChatBubbleLeftIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No chats yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {chatSessions.map((chat) => (
              <div
                key={chat.id}
                className={`group relative flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                  activeChatId === chat.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                onClick={() => onChatSelect(chat.id)}
              >
                <ChatBubbleLeftIcon className="w-4 h-4 flex-shrink-0" />
                
                {editingId === chat.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleRename(chat.id, editTitle)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRename(chat.id, editTitle);
                      } else if (e.key === 'Escape') {
                        cancelEditing();
                      }
                    }}
                    className="flex-1 bg-transparent border-none outline-none text-sm"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 text-sm truncate">{chat.title}</span>
                )}

                {/* Menu Button */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === chat.id ? null : chat.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-opacity"
                  >
                    <EllipsisVerticalIcon className="w-3 h-3" />
                  </button>

                  {/* Dropdown Menu */}
                  {menuOpenId === chat.id && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(chat);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <PencilIcon className="w-3 h-3" />
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(chat.id);
                          setMenuOpenId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <TrashIcon className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
