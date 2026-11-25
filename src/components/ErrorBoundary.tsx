import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'حدث خطأ غير متوقع في التطبيق.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as {
          error?: string;
          operationType?: string;
        };
        if (parsed.error) {
          friendly = `تعذر إتمام عملية المزامنة (${parsed.operationType || 'sync'}): ${parsed.error}`;
        }
      } catch {
        // use raw message
      }

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#140309] p-6 text-rose-50">
          <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-rose-950/70 p-6 text-center backdrop-blur-xl shadow-2xl">
            <h2 className="text-xl font-bold text-rose-200 mb-2">
              تنبيه المزامنة
            </h2>
            <p className="text-sm text-rose-100/80 mb-5 break-words leading-relaxed">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-rose-500 transition-colors"
            >
              إعادة تحميل التطبيق
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
