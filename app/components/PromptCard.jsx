// app/components/PromptCard.jsx
export default function PromptCard({ title, children, footer }) {
  return (
    <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 mb-5">
      {title && <h2 className="text-xl font-semibold mb-3">{title}</h2>}
      <div className="text-gray-800">{children}</div>
      {footer && <div className="mt-4">{footer}</div>}
    </section>
  );
}
