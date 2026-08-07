'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type FaqItem = {
  question: string;
  answer: string;
};

export function Faq({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="border-t border-ivory/[0.1]">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={item.question} className="border-b border-ivory/[0.1]">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="group flex w-full items-start justify-between gap-6 py-5 text-left outline-none"
              aria-expanded={isOpen}
            >
              <span
                className={`display text-[1.05rem] leading-snug transition-colors duration-300 sm:text-[1.15rem] ${
                  isOpen ? 'text-ivory' : 'text-ivory/70 group-hover:text-ivory'
                }`}
              >
                {item.question}
              </span>
              <span
                aria-hidden="true"
                className={`mt-1 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border text-sm transition-all duration-300 ${
                  isOpen
                    ? 'rotate-45 border-celeste/60 text-celeste'
                    : 'border-ivory/20 text-ivory/50 group-hover:border-ivory/40'
                }`}
              >
                +
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                  className="overflow-hidden"
                >
                  <p className="max-w-prose pb-6 pr-10 text-[16px] leading-relaxed text-ivory/65">
                    {item.answer}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
