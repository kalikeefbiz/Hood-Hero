import { applyInfluence } from "./Territory";
import { clamp, type Employment, type GameState } from "../core/GameState";
import { record } from "../core/EventLog";
import { random } from "../core/Random";
import { BALANCE } from "../content/balance";
import { JOBS, jobDefinition, weekday } from "../content/jobs";
import { earn } from "./Economy";
import { change, remember, connect } from "./Relationships";
const B = BALANCE.employment;
export const currentEmployment = (s: GameState, actor = s.playerId) =>
  s.employment.find((e) => e.actor === actor && e.status === "employed");
export const searchState = (s: GameState, actor: string) =>
  s.employmentSearch[actor] ?? { eligibleDay: 1 };
export function nextShift(s: GameState, e: Employment, after = s.day) {
  for (let d = Math.max(after, e.hiredDay + 1); d < after + 15; d++)
    if (
      e.workdays.includes(weekday(d)) &&
      !e.attendance.some((a) => a.day === d)
    )
      return d;
  return undefined;
}
export const shiftToday = (s: GameState, actor = s.playerId) =>
  s.commitments.find(
    (c) =>
      c.actor === actor &&
      c.kind === "employment-shift" &&
      c.dueDay === s.day &&
      c.status === "pending",
  );
export function jobError(
  s: GameState,
  actor: string,
  jobId?: string,
): string | null {
  const c = s.characters[actor],
    j = JOBS.find((j) => j.id === jobId);
  if (currentEmployment(s, actor))
    return "Already employed. Resign before applying elsewhere.";
  const search = searchState(s, actor);
  if (s.day < search.eligibleDay)
    return `Formal applications reopen on day ${search.eligibleDay}. Local gigs remain available.`;
  if (!j) return "Choose a job opportunity";
  if (
    s.employment.some(
      (e) => e.actor === actor && e.jobId === j.id && s.day < e.rehireDay,
    )
  )
    return "This workplace is not ready to rehire you yet";
  if (c.skills.work < j.minWork || c.skills.social < j.minSocial)
    return `Requires work ${j.minWork} and social ${j.minSocial}`;
  if (
    j.id.startsWith("retail") &&
    c.home !== j.location &&
    !c.connections.includes(j.employer)
  )
    return "A local contact or local address is required";
  if (s.characters[j.employer].status !== "active")
    return "Hiring contact is unavailable";
  return null;
}
export const jobOpportunities = (s: GameState, actor = s.playerId) =>
  JOBS.filter(
    (j) =>
      !j.id.startsWith("retail") ||
      s.characters[actor].home === j.location ||
      s.characters[actor].connections.includes(j.employer),
  );
export function applyForJob(s: GameState, actor: string, jobId: string) {
  const search = (s.employmentSearch[actor] ??= { eligibleDay: 1 });
  search.offeredJob = jobId;
  search.lastApplicationDay = s.day;
  const j = jobDefinition(jobId),
    c = s.characters[actor],
    employer = s.characters[j.employer];
  connect(s, actor, employer.id);
  c.known = [...new Set([...c.known, employer.id])];
  employer.known = [...new Set([...employer.known, actor])];
  change(employer, actor, {});
  change(c, employer.id, {});
  return record(
    s,
    "social",
    `${employer.name}: “We can offer you ${j.name.toLowerCase()}, $${j.wage} per shift. Check the schedule before you accept.”`,
    [actor, employer.id],
  );
}
export function acceptJob(s: GameState, actor: string, jobId: string) {
  const j = jobDefinition(jobId),
    previous = s.employment.filter((e) => e.actor === actor).at(-1);
  const e: Employment = {
    id: `employment-${s.nextId++}`,
    actor,
    jobId,
    employer: j.employer,
    location: j.location,
    status: "employed",
    hiredDay: s.day,
    wage: j.wage,
    workdays: [...j.workdays],
    attendance: [],
    reliability: previous ? Math.min(60, previous.reliability) : 60,
    performance: 0,
    warnings: 0,
    rehireDay: s.day,
    timeOffDays: [],
    raised: false,
    eventIds: [],
  };
  s.employment.push(e);
  delete s.employmentSearch[actor].offeredJob;
  const event = record(
    s,
    "social",
    `${s.characters[j.employer].name}: “You're hired. First shift: day ${nextShift(s, e)}. Show up and we'll build from there.”`,
    [actor, j.employer],
    undefined,
    { importance: "major", title: "Hired · " + j.name },
  );
  e.eventIds.push(event.id);
  remember(
    s,
    e.employer,
    actor,
    event.id,
    "Accepted a regular work schedule.",
    4,
  );
  return event;
}
// Materialize today's obligation only. The UI calculates the following dates from the recurrence.
export function generateShifts(s: GameState) {
  for (const e of s.employment.filter((e) => e.status === "employed")) {
    if (
      s.day <= e.hiredDay ||
      !e.workdays.includes(weekday(s.day)) ||
      s.commitments.some((c) => c.employmentId === e.id && c.dueDay === s.day)
    )
      continue;
    s.commitments.push({
      id: `commitment-${s.nextId++}`,
      origin: e.eventIds[0],
      requester: e.employer,
      actor: e.actor,
      beneficiary: e.employer,
      createdDay: s.day,
      dueDay: s.day,
      kind: "employment-shift",
      employmentId: e.id,
      status: "pending",
      evidence: [],
      warned: false,
      consequences: {
        fulfilled: { trust: 3, respect: 2, grievance: 0 },
        broken: { trust: -8, respect: -4, grievance: 5 },
        released: { trust: 0, respect: 0, grievance: 0 },
      },
    });
  }
}
function attendance(
  s: GameState,
  e: Employment,
  status: "worked" | "missed" | "excused",
  text: string,
) {
  const c = shiftToday(s, e.actor);
  if (!c || e.attendance.some((a) => a.day === s.day)) return;
  c.status =
    status === "worked"
      ? "fulfilled"
      : status === "missed"
        ? "broken"
        : "released";
  change(
    s.characters[e.employer],
    e.actor,
    c.consequences[
      status === "worked"
        ? "fulfilled"
        : status === "missed"
          ? "broken"
          : "released"
    ],
  );
  const event = record(
    s,
    status === "worked" ? "money" : "social",
    text,
    [e.actor, e.employer],
    undefined,
    {
      importance: status === "worked" ? "routine" : "personal",
      commitmentId: c.id,
    },
  );
  c.evidence.push(event.id);
  e.attendance.push({ day: s.day, status, eventId: event.id });
  e.eventIds.push(event.id);
  remember(
    s,
    e.employer,
    e.actor,
    event.id,
    status === "worked"
      ? "Kept a scheduled shift."
      : status === "missed"
        ? "Missed a scheduled shift without leave."
        : "Agreed to unpaid leave.",
    status === "worked" ? 3 : status === "missed" ? -8 : 0,
  );
  return event;
}
export function workShift(s: GameState, actor: string) {
  const e = currentEmployment(s, actor)!,
    c = s.characters[actor];
  earn(
    s,
    c,
    e.wage,
    "clean",
    `Scheduled shift · ${jobDefinition(e.jobId).name}`,
  );
  applyInfluence(s, {
    actor,
    faction: null,
    zone: e.location,
    kind: "economic",
    magnitude: 0.5,
    cause: `${c.name} supported lawful trade through scheduled employment.`,
  });
  c.stress = clamp(c.stress + 8);
  c.skills.work = clamp(c.skills.work + 1);
  c.legitimacy = clamp(c.legitimacy + 3);
  c.influence += 1;
  c.neighborhoodStanding[e.location] = clamp(
    c.neighborhoodStanding[e.location] + 1,
  );
  e.reliability = clamp(e.reliability + B.reliabilityGain);
  e.performance++;
  if (actor === s.playerId) s.progression.jobs++;
  const event = attendance(
    s,
    e,
    "worked",
    `${c.name} worked a scheduled shift and earned $${e.wage} in lawful pay. +1 work skill, +8 stress.`,
  )!;
  if (
    !e.raised &&
    e.attendance.filter((a) => a.status === "worked").length >= B.raiseShifts &&
    e.reliability >= 75 &&
    e.warnings === 0
  ) {
    e.raised = true;
    e.wage += B.raiseAmount;
    const raise = record(
      s,
      "social",
      `${s.characters[e.employer].name}: “You've been dependable. From your next shift, it's $${e.wage}.”`,
      [actor, e.employer],
      undefined,
      { importance: "major", title: "Wage increase" },
    );
    e.eventIds.push(raise.id);
  }
  if (actor === s.playerId) {
    const roll = random(s);
    const title =
      roll < 0.16
        ? "Difficult shift"
        : roll < 0.3 &&
            s.characters.flacco.status === "active" &&
            s.characters.flacco.availableDay <= s.day
          ? "Coworker request"
          : roll < 0.42 && e.reliability >= 75
            ? "Extra work offer"
            : null;
    if (title) {
      const scene = record(
        s,
        "social",
        title === "Difficult shift"
          ? "A delivery count is wrong. Your supervisor asks how you want to handle the extra pressure."
          : title === "Coworker request"
            ? "A coworker asks for a hand finishing their station before closing."
            : "Your reliable work brought an offer: finish an extra task for $18, with more stress. It fits within today's shift.",
        [actor, e.employer],
        undefined,
        { title, importance: "personal" },
      );
      e.eventIds.push(scene.id);
    }
  }
  return event;
}
export function endEmployment(s: GameState, e: Employment, fired: boolean) {
  e.status = fired ? "terminated" : "resigned";
  e.endedDay = s.day;
  e.rehireDay = s.day + B.sameEmployerCooldown;
  const search = (s.employmentSearch[e.actor] ??= { eligibleDay: 1 });
  search.eligibleDay =
    s.day + (fired ? B.firingCooldown : B.resignationCooldown);
  delete search.offeredJob;
  const pending = shiftToday(s, e.actor);
  change(s.characters[e.employer], e.actor, {
    trust: fired ? -15 : pending ? -6 : -2,
    respect: fired ? -8 : 0,
  });
  for (const c of s.commitments.filter(
    (c) => c.employmentId === e.id && c.status === "pending",
  ))
    c.status = "released";
  const event = record(
    s,
    "social",
    fired
      ? `${s.characters[e.employer].name}: “Three absences in your last five scheduled shifts. We can't keep covering your place. We're letting you go.” Formal applications reopen on day ${search.eligibleDay}; local gigs remain available.`
      : `${s.characters[e.employer].name}: “I've recorded your resignation. We'll cover the remaining shifts.” Formal applications reopen on day ${search.eligibleDay}; this workplace will reconsider on day ${e.rehireDay}.`,
    [e.actor, e.employer],
    undefined,
    {
      importance: fired ? "critical" : "major",
      title: fired ? "Employment terminated" : "Resigned from work",
    },
  );
  e.eventIds.push(event.id);
  remember(
    s,
    e.employer,
    e.actor,
    event.id,
    fired
      ? "Terminated after repeated absences."
      : "Resigned from the schedule.",
    fired ? -20 : -3,
  );
  return event;
}
export function settleAttendance(s: GameState) {
  for (const e of s.employment.filter((e) => e.status === "employed")) {
    if (!shiftToday(s, e.actor)) continue;
    e.reliability = clamp(e.reliability - B.reliabilityLoss);
    attendance(
      s,
      e,
      "missed",
      `Missed scheduled shift · ${jobDefinition(e.jobId).name}. Reliability fell to ${e.reliability}. No wages earned.`,
    );
    const misses = e.attendance
      .slice(-B.attendanceWindow)
      .filter((a) => a.status === "missed").length;
    if (misses >= B.terminationMisses) endEmployment(s, e, true);
    else if (misses >= B.warningMisses) {
      e.warnings++;
      record(
        s,
        "social",
        `${s.characters[e.employer].name}: “This is a formal warning. Another absence could cost you the job.”`,
        [e.actor, e.employer],
        undefined,
        { importance: "major", title: "Attendance warning" },
      );
    }
  }
}
export function requestTimeOff(s: GameState, actor: string) {
  const e = currentEmployment(s, actor)!;
  e.timeOffDays.push(s.day);
  return attendance(
    s,
    e,
    "excused",
    `${s.characters[e.employer].name} approved unpaid time off for today's shift. No absence and no wages.`,
  )!;
}
export function absenceWarning(s: GameState) {
  if (!shiftToday(s)) return null;
  const e = currentEmployment(s)!;
  const misses =
    e.attendance
      .slice(-(B.attendanceWindow - 1))
      .filter((a) => a.status === "missed").length + 1;
  return `Today's shift is unfinished. Ending the day forfeits $${e.wage}, reduces reliability by ${B.reliabilityLoss}${misses >= B.terminationMisses ? ", and will terminate your employment" : misses >= B.warningMisses ? ", and brings a formal warning" : ". Repeated absences can cost you the job"}.`;
}
