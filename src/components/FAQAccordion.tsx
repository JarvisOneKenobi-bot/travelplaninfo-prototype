interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
}

export default function FAQAccordion({ items }: FAQAccordionProps) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-10">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <details
            key={i}
            className="border-l-4 border-orange-500 pl-4 py-2 group"
          >
            <summary className="cursor-pointer font-semibold text-gray-900 list-none flex justify-between items-center select-none">
              {item.question}
              <span className="ml-2 text-orange-500 text-lg transition-transform group-open:rotate-180">▾</span>
            </summary>
            <p className="mt-2 text-gray-700 leading-relaxed">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
