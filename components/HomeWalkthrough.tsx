'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from './icons';

/**
 * Homepage walkthrough: five steps from "something happened" to a
 * filed motion on your case timeline. Each step pairs a short
 * explanation with a small mock of the real screen. Steps advance
 * on their own (slowly) until the visitor picks one; reduced-motion
 * visitors get no auto-advance and no slide animation. All steps
 * are in the DOM, so the content reads fine without JS.
 */

interface Step {
  icon: IconName;
  title: string;
  short: string;
  body: string;
  screen: () => JSX.Element;
}

const STEPS: Step[] = [
  {
    icon: 'chat',
    title: 'Tell us what happened',
    short: 'Plain words',
    body:
      'Type or say it the way you would to a friend. We match your situation to the right ' +
      'court motion and show you why, or you can pick one from the library yourself.',
    screen: ScreenSituation,
  },
  {
    icon: 'list',
    title: 'Answer one question at a time',
    short: 'One per page',
    body:
      'Each question gets its own page, with a hint and big tap-friendly choices. A progress ' +
      'bar shows how far along you are, and Back always works.',
    screen: ScreenQuestion,
  },
  {
    icon: 'sparkle',
    title: 'Polish your statements',
    short: 'Optional AI',
    body:
      'At the end, AI can rewrite what you wrote so it reads clear and professional. You see ' +
      'your words next to the suggestion and keep whichever you want.',
    screen: ScreenPolish,
  },
  {
    icon: 'check',
    title: 'Review, sign, and choose how to pay',
    short: 'Filing-ready PDF',
    body:
      'Check every answer and fix anything with one tap. Sign on screen, then pay $5 or use your membership to download ' +
      'a filing-ready PDF. Need a fee waiver? We add that form for free.',
    screen: ScreenReview,
  },
  {
    icon: 'folder',
    title: 'Stay on top of your case',
    short: 'Timeline & mail',
    body:
      'With membership, your document is saved to a case with its deadlines, court mail, and hearing date, all ' +
      'shown on one timeline. Add your own events as things happen.',
    screen: ScreenCase,
  },
];

const AUTO_MS = 6500;

export default function HomeWalkthrough() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useRef(false);

  // Auto-advance only when motion is welcome and the section is on
  // screen; any manual choice stops it for good.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setAuto(true);
    const el = rootRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => { inView.current = e.isIntersecting; }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto) return;
    const t = window.setInterval(() => {
      if (!inView.current || document.hidden) return;
      setDir(1);
      setActive((a) => (a + 1) % STEPS.length);
    }, AUTO_MS);
    return () => window.clearInterval(t);
  }, [auto]);

  const go = (i: number) => {
    setAuto(false);
    setDir(i >= active ? 1 : -1);
    setActive((i + STEPS.length) % STEPS.length);
  };

  const step = STEPS[active];
  const Screen = step.screen;

  return (
    <div className="walk" ref={rootRef}>
      <ol className="walksteps" role="tablist" aria-label="How it works, step by step">
        {STEPS.map((s, i) => (
          <li key={s.title} role="presentation">
            <button
              type="button"
              role="tab"
              id={`walktab-${i}`}
              aria-selected={i === active}
              aria-controls="walkpanel"
              className={`walkstep${i === active ? ' on' : ''}${i < active ? ' done' : ''}`}
              onClick={() => go(i)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(i + 1); }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(i - 1); }
              }}
            >
              <span className="walknum">{i + 1}</span>
              <span className="walktexts">
                <span className="walktitle">{s.title}</span>
                <span className="walkshort">{s.short}</span>
              </span>
              {i === active && auto && <span className="walktimer" style={{ animationDuration: `${AUTO_MS}ms` }} key={active} />}
            </button>
          </li>
        ))}
      </ol>

      <div className="walkstage" id="walkpanel" role="tabpanel" aria-labelledby={`walktab-${active}`}>
        <div className={`walkcopy${dir < 0 ? ' back' : ''}`} key={`c${active}`}>
          <p className="walkkicker"><Icon name={step.icon} size={16} /> Step {active + 1} of {STEPS.length}</p>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
          <div className="walknav">
            <button type="button" className="btn ghost" onClick={() => go(active - 1)} aria-label="Previous step">
              <Icon name="chevronLeft" size={16} />
            </button>
            <button type="button" className="btn ghost" onClick={() => go(active + 1)} aria-label="Next step">
              <Icon name="chevronRight" size={16} />
            </button>
            {active === STEPS.length - 1 && (
              <Link className="btn primary" href="/interview">Start yours</Link>
            )}
          </div>
        </div>
        <div className="walkdevice" aria-hidden="true">
          <div className="walkscreen">
            <div className="mockbar"><span className="mockbrand">quik<b>Form</b></span></div>
            <div className={`mockbody${dir < 0 ? ' back' : ''}`} key={`s${active}`}>
              <Screen />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Mock screens (decorative copies of the real UI) ---------- */

function ScreenSituation() {
  return (
    <>
      <p className="mq">What is going on with your case?</p>
      <div className="mfield tall">
        My hearing is next Tuesday but I am having surgery that week and can&apos;t be there.
      </div>
      <div className="mmatch">
        <span className="mtag">Best match</span>
        <strong>Motion to Continue Hearing</strong>
        <span>Asks the judge to move your hearing to a later date.</span>
      </div>
      <div className="mbtn primary">Yes, that is the one</div>
      <div className="mbtn">Show me the full library</div>
    </>
  );
}

function ScreenQuestion() {
  return (
    <>
      <div className="mprog"><span style={{ width: '45%' }} /></div>
      <p className="mstep">Question 5 of 11</p>
      <p className="mq">Why do you need the hearing moved?</p>
      <p className="mhint">Pick the closest one.</p>
      <div className="mopt on">Medical reason</div>
      <div className="mopt">Work or school conflict</div>
      <div className="mopt">Need time to get a lawyer</div>
      <div className="mopt">Other…</div>
      <div className="mnav"><span className="mbtn">Back</span><span className="mbtn primary">Next</span></div>
    </>
  );
}

function ScreenPolish() {
  return (
    <>
      <p className="mq small"><Icon name="sparkle" size={14} /> Polish your statements</p>
      <div className="mcompare">
        <div>
          <span className="mlabel">Yours</span>
          <p>i cant be there cuz im having surgery that week and the doctor says no driving</p>
        </div>
        <div className="sugg">
          <span className="mlabel">Suggested</span>
          <p>I am scheduled for surgery during the week of the hearing, and my physician has advised that I not travel.</p>
        </div>
      </div>
      <div className="mnav"><span className="mbtn">Keep mine</span><span className="mbtn primary">Use suggestion</span></div>
    </>
  );
}

function ScreenReview() {
  return (
    <>
      <p className="mq small">Review your answers</p>
      {[
        ['Court', 'Maricopa County Superior Court'],
        ['Case number', 'CV2026-014532'],
        ['Hearing date', 'Tue, Dec 1, 2026'],
        ['Reason', 'Scheduled surgery…'],
      ].map(([k, v]) => (
        <div className="mrow" key={k}>
          <span><span className="mlabel">{k}</span>{v}</span>
          <span className="medit">Edit</span>
        </div>
      ))}
      <div className="msig">J. Rivera</div>
      <div className="mbtn primary">Get my PDF · $5</div>
    </>
  );
}

function ScreenCase() {
  return (
    <>
      <p className="mq small">Rivera v. Rivera</p>
      <div className="mnext"><span className="mlabel">Next up</span>Response deadline · Dec 8</div>
      <div className="mtl">
        {[
          ['Nov 24', 'Motion to Continue filed', 'doc'],
          ['Nov 26', 'Court mail: notice received', 'mail'],
          ['Dec 8', 'Response deadline', 'calendar'],
          ['Dec 15', 'Rescheduled hearing', 'gavel'],
        ].map(([d, t, ic]) => (
          <div className="mtlitem" key={t}>
            <span className="mtldot"><Icon name={ic as IconName} size={12} /></span>
            <span><span className="mlabel">{d}</span>{t}</span>
          </div>
        ))}
      </div>
      <div className="mbtn">+ Add an event</div>
    </>
  );
}
