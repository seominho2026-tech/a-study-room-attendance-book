import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type?: 'info' | 'confirm' | 'alert' | 'success' | 'warning';
  children: React.ReactNode;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  type = 'info',
  children,
  onConfirm,
  confirmLabel = '확인',
  cancelLabel = '취소',
}: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                {type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
                {type === 'alert' && <AlertCircle className="w-5 h-5 text-rose-500" />}
                {type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                {type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
                <h3 className="font-black text-slate-900 text-lg tracking-tight">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 text-sm text-slate-600 font-bold leading-relaxed whitespace-pre-wrap">
              {children}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              {type === 'confirm' || type === 'warning' || type === 'alert' || onConfirm ? (
                <>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-xl text-xs font-black transition-all cursor-pointer border-0"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    onClick={() => {
                      if (onConfirm) onConfirm();
                      onClose();
                    }}
                    className={`px-5 py-2 rounded-xl text-xs font-black text-white transition-all cursor-pointer border-0 ${
                      type === 'warning'
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : type === 'alert'
                        ? 'bg-rose-500 hover:bg-rose-600'
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    {confirmLabel}
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-blue-500 text-white hover:bg-blue-600 rounded-xl text-xs font-black transition-all cursor-pointer border-0 shadow-md"
                >
                  {confirmLabel}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
