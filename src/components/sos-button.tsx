"use client";

export function SosButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <div className="relative mx-auto flex flex-col items-center justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="group relative flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-red-700 text-white shadow-xl transition duration-200 hover:scale-[1.02] hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-4 focus:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-50 sm:h-40 sm:w-40"
        aria-label="Emergency SOS"
      >
        <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl transition group-hover:bg-red-500/30" />
        <div className="absolute inset-1 rounded-full border border-white/20" />
        <span className="relative text-4xl font-extrabold tracking-tight sm:text-5xl">SOS</span>
      </button>
      <p className="mt-3 text-xs font-medium text-gray-500">Hold for emergency • Instant alert</p>
    </div>
  );
}
