import { notFound } from 'next/navigation'

import { Button, Card, Dot, Panel, Pill } from '@nel3ab/ui'

import styles from './styleguide.module.css'

// REQ-2.11 — the proof surface. See specs/phase-2/specs.md §2.14.
//
// Every primitive and every variant, rendered twice on one page: once in a
// forced-light subtree and once in a forced-dark one. That is only possible
// because tokens.css scopes each palette to `[data-theme]` on ANY element, not
// to `:root` alone (REQ-2.5). This page is where a human performs the
// side-by-side comparison against the prototypes that no automated check can
// (verification.md Gate 6).
//
// It does not ship. `process.env.NODE_ENV` is inlined by Next at build time, so
// in a production build this is a static branch to notFound() — the route stays
// in the project, so `pnpm typecheck` and `next build` keep compiling it and
// the primitives it imports, but it is unreachable in a deployment
// (mission.md §6: نلعب is not a showcase).
//
// It is NOT a screen and must not grow into a mock of one (requirements.md §4):
// no timer card, no question card contents, no team tile. Sample text is taken
// from the prototype (design/designs/Nel3ab - Arcade.dc.html) so the comparison
// is like for like.

export default function StyleguidePage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main className={styles.page}>
      <Samples theme="light" />
      <Samples theme="dark" />
    </main>
  )
}

function Samples({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <section data-theme={theme} className={styles.theme} aria-labelledby={`theme-${theme}`}>
      <h1 id={`theme-${theme}`} className={styles.heading}>
        <bdi className="ltr-num">{theme}</bdi>
      </h1>

      <Group name="Panel">
        <Panel>مرفوعة</Panel>
        <Panel raised={false}>مسطّحة</Panel>
      </Group>

      <Group name="Card">
        <Card>md</Card>
        <Card size="lg">
          <div className={styles.inset}>lg — غلاف بطاقة السؤال</div>
        </Card>
      </Group>

      <Group name="Pill">
        {(['panel', 'red', 'sky', 'yellow'] as const).map((tone) => (
          <Pill key={tone} tone={tone}>
            فريق ١
          </Pill>
        ))}
        {(['panel', 'red', 'sky', 'yellow'] as const).map((tone) => (
          <Pill key={`${tone}-selected`} tone={tone} selected>
            فريق ١
          </Pill>
        ))}
      </Group>

      <Group name="Dot">
        <Dot won />
        <Dot />
        <Dot size="md" won />
        <Dot size="md" />
      </Group>

      <Group name="Button">
        <div className={styles.stack}>
          <Button variant="primary">
            <span>ابدأ الجولة الأولى</span>
            <span>▶</span>
          </Button>
          <Button variant="primary" disabled>
            <span>ابدأ الجولة الأولى</span>
            <span>▶</span>
          </Button>
          <div className={styles.actions}>
            <Button variant="action" subLabel="يمرّ الدور">
              تخطي ⏭
            </Button>
            <Button variant="action" data-tone="yellow" subLabel="−٣ ثوانٍ">
              تلميح 💡
            </Button>
            <Button variant="action" data-tone="leaf">
              صحيح ✔
            </Button>
          </div>
          <div className={styles.actions}>
            <Button variant="action" disabled subLabel="يمرّ الدور">
              تخطي ⏭
            </Button>
            <Button variant="action" data-tone="yellow" disabled subLabel="−٣ ثوانٍ">
              تلميح 💡
            </Button>
            <Button variant="action" data-tone="leaf" disabled>
              صحيح ✔
            </Button>
          </div>
          <Button variant="secondary">جولة جديدة</Button>
          <Button variant="secondary" disabled>
            جولة جديدة
          </Button>
        </div>
      </Group>

      <Group name="ltr-num">
        <p className={styles.prose}>
          رمز الغرفة <span className="ltr-num">SKZJ62</span>، وبقي{' '}
          <span className="ltr-num">45</span> ثانية.
        </p>
      </Group>

      <Group name="focus-visible">
        <a className={styles.link} href={`#theme-${theme}`}>
          رابط للتركيز
        </a>
      </Group>
    </section>
  )
}

function Group({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className={styles.group}>
      <h2 className={styles.label}>
        <bdi className="ltr-num">{name}</bdi>
      </h2>
      <div className={styles.row}>{children}</div>
    </div>
  )
}
