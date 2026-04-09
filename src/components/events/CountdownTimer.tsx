import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetDate: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(target: string): TimeLeft | null {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export default function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(calculateTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) {
    return <span className="text-sm font-medium text-primary-600">Эхэлсэн!</span>;
  }

  const units = [
    { value: timeLeft.days, label: 'өдөр' },
    { value: timeLeft.hours, label: 'цаг' },
    { value: timeLeft.minutes, label: 'мин' },
    { value: timeLeft.seconds, label: 'сек' },
  ];

  return (
    <div className="flex gap-2">
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center bg-primary-50 rounded-lg px-2.5 py-1.5 min-w-[48px]">
          <span className="text-lg font-bold text-primary-700 leading-none">{u.value}</span>
          <span className="text-[10px] text-primary-500 mt-0.5">{u.label}</span>
        </div>
      ))}
    </div>
  );
}
