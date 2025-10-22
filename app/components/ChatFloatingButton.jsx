// app/components/ChatFloatingButton.jsx
"use client";

export default function ChatFloatingButton({ onClick, badge = 0, hidden = false }) {
  if (hidden) return null;
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-30 rounded-full border bg-white p-3 shadow-lg hover:bg-gray-50"
      aria-label="Open chat"
      title="Open chat"
    >
      <span className="text-lg">💬</span>
      {badge > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}
