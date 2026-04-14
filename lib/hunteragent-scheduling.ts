import { Profile, WorkspaceState } from "@/lib/hunteragent-types";

export const CRON_CADENCE_MINUTES = 15;

function getLocalParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function parseBriefTime(briefTime: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(briefTime.trim());
  if (!match) {
    return { hour: 8, minute: 0 };
  }

  return {
    hour: Math.max(0, Math.min(23, Number(match[1]))),
    minute: Math.max(0, Math.min(59, Number(match[2]))),
  };
}

function dayKeyFor(date: Date, timeZone: string) {
  const parts = getLocalParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function minuteOfDay(hour: number, minute: number) {
  return hour * 60 + minute;
}

export function hasSentBriefOnLocalDay(state: WorkspaceState, date: Date = new Date()) {
  const targetDay = dayKeyFor(date, state.profile.timezone);
  return state.briefs.some((brief) => brief.sentAt && dayKeyFor(new Date(brief.sentAt), state.profile.timezone) === targetDay);
}

export function shouldRunBriefNow(profile: Profile, now: Date = new Date(), cadenceMinutes = CRON_CADENCE_MINUTES) {
  if (profile.briefsPaused) return false;
  if (!profile.recipientEmail.trim()) return false;

  const local = getLocalParts(now, profile.timezone);
  const target = parseBriefTime(profile.briefTime);
  const currentMinute = minuteOfDay(local.hour, local.minute);
  const scheduledMinute = minuteOfDay(target.hour, target.minute);

  const delta = (currentMinute - scheduledMinute + 1440) % 1440;
  return delta >= 0 && delta < cadenceMinutes;
}

export function describeSchedulerWindow(profile: Profile) {
  const { hour, minute } = parseBriefTime(profile.briefTime);
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return `${time} ${profile.timezone}`;
}
