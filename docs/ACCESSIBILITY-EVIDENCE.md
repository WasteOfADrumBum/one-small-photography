# Accessibility evidence

Target: the applicable WCAG 2.2 level A and AA success criteria. Automated checks find many
problems but cannot prove conformance, so this page keeps three kinds of evidence apart.

## 1. Automated, on every pull request (Chromium) and weekly (Firefox, WebKit)

`e2e/a11y.spec.ts`, against the built site with synthetic albums. Each test checks behaviour
in a real browser, not only that an attribute is present.

| Test                                                        | What it proves                                                                                                                                                      | Criteria (main)     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Public pages have no detectable WCAG 2.2 AA violations      | axe-core 4.14 (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) on home, portfolio, an album, an empty album, contact, the Triad, under the hood, login, 404 | many                |
| One main landmark, a level-one heading and a language       | Landmarks and page structure on every public page                                                                                                                   | 1.3.1, 2.4.2, 3.1.1 |
| Album links have a name in the browser's accessibility tree | Reads Chromium's own accessibility tree (DevTools protocol), so it checks what a screen reader gets, not the DOM                                                    | 2.4.4, 4.1.2        |
| Every picture has a text alternative                        | Each gallery image has non-empty alt, falling back to the title when alt is blank                                                                                   | 1.1.1               |
| The open photo viewer passes axe and announces the photo    | Dialog open state; "Photo N of M" in a live region                                                                                                                  | 4.1.2, 4.1.3        |
| The phone menu opens, passes axe, and Escape returns focus  | Menu open state, Escape, focus restoration                                                                                                                          | 2.1.1, 2.4.3        |
| Form errors are announced and pass axe                      | Contact errors in an alert region, field linked to its message                                                                                                      | 3.3.1, 4.1.3        |
| Keyboard focus is always visible                            | Tabs through each page and measures a visible focus indicator on every stop                                                                                         | 2.4.7, 2.4.11       |
| With reduced motion, content shows at once                  | `prefers-reduced-motion: reduce` leaves no hidden or animating content                                                                                              | 2.3.3               |
| Pages reflow at 320 CSS pixels                              | No sideways scrolling at 320 px                                                                                                                                     | 1.4.10              |
| Text at twice the size still fits                           | 200% text with no sideways scrolling                                                                                                                                | 1.4.4               |
| The log-in icon explains itself on keyboard focus           | Its tooltip appears on focus, not only on hover                                                                                                                     | 1.4.13, 2.1.1       |
| Admin pages pass axe, including the upload card and notice  | Albums list, album editor with an upload ready, the "saved" status message                                                                                          | many                |
| The admin reflows at 320 CSS pixels                         | No sideways scrolling in the editor on a phone width                                                                                                                | 1.4.10              |

Also in the suite: `lightbox.spec.ts` (keyboard-only use, focus kept inside the open viewer and
returned to the photo, controls usable by touch and without hover, 24 px targets), and the admin
journey reorders photos with the **Move later** button rather than dragging (2.5.7).

**Defect found by this suite and fixed (2026-11-05):** album links on the home and portfolio
pages had no accessible name in Chrome. The link wrapped a `<figure>`, and Chrome did not take
the link's name from it. The figure now has `role="none"` inside links; the accessibility-tree
test above keeps it fixed.

## 2. Earlier automated and scripted checks (still in scope)

[RELEASE.md](RELEASE.md) "Accessibility" records the 2026-11-02 axe run at five viewports and
the scripted Tab walk, text-spacing and reflow checks. The pages it covered have not been
redesigned since, so it still applies as supporting evidence; the suite above now repeats the
main parts on every change.

## 3. Human checks (not automated, not done by an agent)

Owner-reported on 2026-11-03: keyboard, Narrator and phone checks passed (pages, browser and
devices not specified).

Still needing a person, and not claimed here:

- A screen reader pass with VoiceOver (Safari, iPhone) and NVDA or JAWS (Windows), especially
  the photo viewer, the contact form errors and the admin upload flow.
- Browser zoom to 400% on a real desktop, and the phone's own large-text setting.
- A visual review of contrast on real photos (axe checks text, not text over every photo).
- Whether alt text written for real photos is actually descriptive (only a person can judge).

So: the site passes every automated check listed here, on the tested commit. That is not a
claim of full WCAG 2.2 AA conformance.
