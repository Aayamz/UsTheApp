import Logo from '@/components/Logo';
import Link from 'next/link';
import AddToHomeScreenPrompt from '@/components/pwa/AddToHomeScreenPrompt';

export default function FriendJoinedPage() {
  return (
    <div className="min-h-full w-full flex flex-col items-center justify-center gap-6 px-6 py-10 text-center bg-[#1F1324] text-[#F6EFE9] overflow-y-auto">
      <Logo size={48} showWordmark />

      <div className="space-y-3 max-w-xs">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold">You&apos;re in!</h1>
        <p className="text-sm text-[#C9B3D1] leading-relaxed">
          You&apos;ve joined the shared friends space. The couple will share event capsules and group moments with you here.
        </p>
      </div>

      <div className="w-full max-w-xs">
        <AddToHomeScreenPrompt
          title="Add U& to Home Screen"
          subtitle="Add U& to your home screen to easily check shared group capsules anytime."
        />
      </div>

      <div className="w-full max-w-xs bg-[#372A3E] border border-[#4F3C59] rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold text-[#FF8966]">What you can see:</p>
        <ul className="text-xs text-[#C9B3D1] space-y-1.5 text-left">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">✓</span>
            Shared Group Event Capsules (Someday)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">✓</span>
            Group moments the couple shares with friends
          </li>
        </ul>
        <p className="text-xs font-bold text-[#FF8966] mt-3">What stays private:</p>
        <ul className="text-xs text-[#C9B3D1] space-y-1.5 text-left">
          <li className="flex items-start gap-2">
            <span className="text-red-400 mt-0.5">✗</span>
            Their private Trail, Spark, Pick & Nudge
          </li>
        </ul>
      </div>

      <Link
        href="/friend-space"
        className="w-full max-w-xs py-3.5 bg-[#FF8966] text-[#1F1324] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all hover:bg-[#FF8966]/90 cursor-pointer"
      >
        Continue to Friend Space
      </Link>
    </div>
  );
}
