# UX benchmark: Today, Reels, Quiz and live mock (2026-11-07)

Three flows of the app on an iPhone 13 (WebKit, fresh learner) compared with iOS learning and practice apps on Mobbin. These are proposals only. Each is listed under "Needs approval" in `tools/improve/BACKLOG.md` and is not built until the user says yes.

References (iOS, Mobbin):
- Home: [Mimo practice home](https://mobbin.com/screens/b33e7987-1a4c-4fef-a965-db3eb7359297), [Brilliant streak sheet](https://mobbin.com/screens/ef4aab61-b37e-465f-a45c-a0de874c9ffa), [Duolingo streak widget](https://mobbin.com/screens/292dabe3-384b-4a45-81d8-85d998bbf852), [Headway home](https://mobbin.com/screens/a8fca4da-5640-41e8-bd8d-381bd007e0f3), [Calm week streak](https://mobbin.com/screens/82e555db-347c-4690-95fe-fb1d395b9c7e)
- Short video player: [Nibble watch feed](https://mobbin.com/screens/355989e4-005b-4e64-8058-10c9094453da), [Me+ lesson video](https://mobbin.com/screens/b1fe6829-92cc-4ddf-a9fd-b06b1649622f), [Grok video viewer](https://mobbin.com/screens/dacabceb-247c-463b-b227-b36ab587a784), [LinkedIn video feed](https://mobbin.com/screens/cc2119b5-d674-42db-a1d1-da0d5a0359b1)
- Quiz: [Nibble question with explanation](https://mobbin.com/screens/93499943-b5af-4860-a9b2-23740d190ccd), [Brainly Correct sheet](https://mobbin.com/screens/04584694-b270-455f-a54d-956600458d2e), [Quizlet Learn](https://mobbin.com/screens/4f303c97-3a12-49ee-83ab-97254c04e17b), [Liven single choice](https://mobbin.com/screens/a51266c4-3c5d-4530-8ba4-30be21c7f09a)

## 1. Today (home)

What the app does now: greeting, a level chip (L1, streak, quests), then Up next with Read and Readings buttons, the step's section list and "Done when", then the Today box with Reading, Coding and Interview tabs. Up next and its main button sit on the first screen.

1. **Shorten Up next to one line of what you will read** (from Mimo and Headway). Mimo's daily card shows a title, minutes and one Start now button. The app's Up next prints every section name of the step (seven on the first day) plus "Done when", which pushes the Today box to the bottom edge. Show the first two section names and "+5 more", and move "Done when" behind the step.
2. **A week strip of streak days next to the level chip** (from Brilliant, Calm and Duolingo). All three show M T W T F S S with ticks, so a missed day is visible at a glance. The app shows only a number ("0"), and the weekly freeze is explained only on Progress. A tap on the chip could open the strip as a small sheet, as Brilliant does.
3. **One primary button per card** (from Mimo). Up next has two buttons of equal weight (Read and Readings). Readings is the second tab of the same module, so it could move into the module card's Open module menu.

## 2. Reels player

What the app does now: a full-screen dark card with close, My week / Shuffle, a counter (1/1175), filter chips (Everything, Weak spots, Done before, tracks), progress bars per beat, a Play card, captions at the bottom and a rail with heart, speed and voice.

4. **Put the title and module at the bottom, above the caption** (from Nibble, Me+ and LinkedIn). All three keep the top clear apart from close and sound, and put the topic and title just above the progress bar. The app stacks the mode switch, filters and title at the top, where the filter row and title fought for the same space (fixed as a bug in 1.32.1; the stacking remains).
5. **Fold the filters into one chip** (from Grok and Weverse, which keep only one row of controls over the video). Replace the scrolling filter row with one "Everything ▾" chip that opens a small sheet. That frees the top of the card and avoids a horizontally scrolling row hiding tracks off-screen.
6. **Drop the "1/1175" counter in Shuffle** (from Nibble and LinkedIn, which show no count in an endless feed). A count of over a thousand says "you will never finish". Show the count only in My week, where the list is short and finishing it is the goal.
7. **A thin progress line instead of beat bars when there are many beats** (from Me+ and Grok). They show one line under the title. The beat bars are good for 4 to 6 beats; reels with more get very short segments on a phone.

## 3. Quiz and live mock

What the app does now: quiz shows a close button next to a progress bar and "0 of 20 answered", a module picker, the question card with options A to D, and Previous / Save and next / Submit pinned above the tab bar. Feedback comes after Submit, at the end. The live mock lists all questions with the level choice (Senior / Staff) and Start below the first screen.

8. **Show right or wrong right after each answer, with a one-line why** (from Nibble, Brainly and Quizlet). All three mark the chosen option green or red at once and show the reason under it, then a single Continue. The app waits for Submit at the end, so the learner reads twenty explanations at once after forgetting the questions. Keep the end score, add a per-question "Check" for practice quizzes (the module test can stay as now).
9. **One button at the bottom: Continue** (from Nibble, Quizlet and Liven). The app shows three buttons (Previous, Save and next, Submit). Previous can move to a swipe or the question palette, and Submit can appear only on the last question (it is already quiet until then).
10. **Live mock: put Start and the level choice on the first screen** (from Liven, whose quiz intro puts the main button at the bottom of the first screen). On an iPhone the seven weekend questions fill the screen and Start is below it, against the app's own rule that the main action shows without scrolling. Fold the list to the kinds of question ("Concept, Org, Migrate, Cost, Estimate, Deep, Recall") and keep the full text one tap away.
11. **Quiz: one way out** (from Quizlet and Liven, which have a single ✕ at top left). The quiz screen has both the header Back button and a ✕ next to the progress bar, which do the same thing.

## Top 3

1. Show right or wrong after each quiz answer with a one-line why (8).
2. Live mock: Start and the level on the first screen (10).
3. Reels: title at the bottom and the filters folded into one chip (4, 5).
