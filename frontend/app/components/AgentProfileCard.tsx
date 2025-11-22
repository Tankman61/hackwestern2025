"use client";

interface AgentProfileCardProps {
  onClick: () => void;
}

export default function AgentProfileCard({ onClick }: AgentProfileCardProps) {
  return (
    <div
      className="border-r p-4 cursor-pointer"
      style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}
      onClick={onClick}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="w-full aspect-square rounded-lg flex items-center justify-center text-6xl border-2 shadow-lg relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--red-9), var(--red-10))', borderColor: 'var(--red-7)' }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent, rgba(139, 92, 246, 0.2))' }}></div>
          <span className="relative z-10">🎯</span>
          <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full border-2" style={{ background: 'var(--green-9)', borderColor: 'var(--slate-2)' }}></div>
        </div>
      </div>
    </div>
  );
}
