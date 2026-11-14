# Write the draft yourself and stream it (when the studio is not available)

Read this only when §S of `SKILL.md` (`nolang make`) cannot be used. For how to give links, follow "Most important" at the top of `SKILL.md`. For login see §L of `SKILL.md`; for specific assets, §M.
You write the script and the screens (draft src = `design.txt` and `timeline.txt`), and the NoLang server handles the voice, pictures, BGM and rendering.
All paths in this file are relative to this skill's directory.

## 1. Write the draft (common to §A and §B; in this order; no detours)

0. **Read the server's current docs** (before you start writing): the grammar docs (spec.md, the dictionary, the samples) are not in the plugin.
   - With a shell: `nolang reference` → the `dir` in the output is the directory of the reference docs (inside the bundle that nolang syncs with the server every time it starts). From here on, wherever this file says `<dir>/<name>`, read that file.
   - Without a shell (MCP): read them with `nolang_draft_reference(path="<name>")` (for a large doc, a list of sections is returned, so pass a heading as `section` and read section by section; for the sample, choose from the list returned by `path="samples/"` as in step 2 of §1).
1. **Decide from the request**: the one sentence you want to get across, the aspect (`16:9` / `9:16`), the rough length (if the request states it, those seconds; otherwise do not specify it = fit to the content), the type (`concept` explainer / `data` numbers / `compare` comparison / `story` story / `cinematic` visual-led), and the language (the language you write the lines in = the one stated in the request, if any; otherwise the language of the request text). Do not ask back; proceed with the defaults, and tell the user the values you chose at the end.
2. **Read the grammar and one sample**: the grammar is §2 (the full text of `<dir>/spec.md`) and, when the directory has it, the full text of `<dir>/core.md` (NoLang's own words — what CSS / GSAP do not have; these two are everything NoLang's own writers read). The other documents are dictionaries: open them only for what you need. Then read in full one sample from `<dir>/samples/` that is close to the video you are making (the title on line 1, the `見せる作り:` ("how it is shown") summary, and all of design.txt and timeline.txt). Take one of your type (`hf_<type>_*.md` or `<type>_NN.md`; line 1 of each file gives its topic and `canvas` size), in the same orientation as your video, and not on the same topic as the request (a sample on the same topic gets copied word for word). Read a second sample only when you need another model. Look at the scaffolds in `<dir>/scaffolds/` only to check the shape of the grammar.
3. **Only when using specific assets**: get a `ref` with §M of `SKILL.md`, and write it in the position given by `usage` in the response.
4. **Write** (design system first; stream each cut as you write it):
   - **Decide the structure before writing**: decide the cut names and contents (one line per cut) first. Each cut is submitted as soon as it is written, and a submitted cut cannot be fixed, so do not go back to earlier cuts while writing.
   - **Decide the design system once, at the root**: from "Style kits" in `<dir>/looks.md`, pick one that fits the mood of the request, and write `palette` `font` `fonts` `motion` `transition` at the root, plus a `def` (= class) for headings, body text, labels and boxes. Fit the values to the topic. The sample is a model of how to build (how scenes are put together, the components' `def`, motion, how to mark words) — do not copy its colors and fonts as they are.
   - Topic-specific things in the root: `image name = "…"` (a description of the reference image), the `bgm` description, `cast` (the voice description, in the language and tone of the request), `art` (art style). Do not write `lint off=…` or `# ` notes.
   - **Rebuild the cuts from the structure of the request**: split the flow of the request into cuts (5–8 cuts for 60 seconds; about 1–3 sentences of lines per cut), assign each cut a matching scene pattern from the sample, and write the text, lines and picture descriptions for the topic. Do not match the sample's number or order of cuts. Delete the scenes and `def`s you do not use.
   - **Do not make an element that has children `.sticky`**: put a `.sticky` that spans cuts only on elements with no children (a single label, a line, `veil`). Things with children, such as a permanent band, chapter labels or progress highlights, should be made into a `def` and placed again in each cut (show the current chapter's highlight and the done marks through per-cut arguments or variants). A `.sticky` with children either stops where the cuts are submitted in order (check's `DEFECT:prefix_broken`), or passes check and then fails at the end of generation (`同じ lane の group は floor が同じであること` ("groups in the same lane must have the same floor") — an engine bug that check cannot catch). Many samples contain this construction, so fix it when you copy it.
   - Keep text short enough to fit its frame (the text length in the sample is a guide; text that is too long triggers check's `shrink_estimate`). Give the elements a new `#name` in each cut, and do not use the same name across cuts (except the root's `.sticky` items).
   - 1 cut = a `section#name` block in design + a `*** name` block in timeline (the names must match). With the CLI, save them as `design.txt` and `timeline.txt` in a working directory (for example `./nolang-videos/<lowercase-english-name>/`).
   - **Writing order**: with the CLI (§A), start streaming once you have written the root + the first cut (step 2 of §A), and after that submit every time you add one cut. Do not submit only after writing everything (that makes the user wait several minutes until playback starts). With MCP (§B), write up to the last cut and then pass it in one go.

## A. Stream with the CLI

1. **Log in**: §L of `SKILL.md`.
2. **Start streaming** (once the root and the first cut are written): `nolang start <dir> --title '<title>' --language <language of the lines: ja / en / …> [--seconds <seconds> (only when there is a rough length)] [--pin <video_id> ("Carry over assets from an earlier video" below)]` (`--language` is required; the aspect comes from `canvas` in design) → then immediately `nolang submit <dir>`. If a DEFECT comes back, fix only that cut and run `nolang submit <dir>` again (a DEFECT appears on stderr as `DEFECT:<code> file:<line> <cause>。直し方: …` ("直し方" = "how to fix"); submitted cuts cannot be fixed, so do not change them). Even if the connection drops and you do not know the result of the submission, just run `nolang submit <dir>` again (it checks against the server's accepted state and submits from where it left off).
3. **Notify** (always; before writing the second cut): once the first submit succeeds, **write the output's `tell_user` (the guidance sentence + the URL on the next line) as is in the body of your message to the user**. Playback starts within tens of seconds, and the rest extends as each cut is submitted.
4. **Stream the rest**: add the next cut to design.txt and timeline.txt and run `nolang submit <dir>`. Repeat this for every cut. **Keep the gap between submissions within 600 seconds** (if it is longer, the server fails the generation) — submit right after you write each cut. For the last cut, run `nolang submit <dir> --end`.
5. **Finish**: when the `--end` submit returns, write the output's `tell_user` (the guidance sentence + the URL on the next line) and end the turn. Check for completion only when asked (`nolang status <video_id> --wait` → on `completed`, tell the user it is complete, with the URL; the mp4 is `download_url`; also pass on the credit notice `copyright` — it must be shown when the video is published).
6. **On failure** (submit returns `404 NOT_FOUND` (`Video not found.`), or status is `failed`): that video is over. Review the draft (check that it does not break the rules in step 4 of §1), then delete `<dir>/stream.json` and remake it from start — at most once (add `--pin <failed video_id>` to start — it carries over the pictures that run made and the voices it chose, without remaking them). If it is still `failed`, stop and tell the user the video_id and that "check passed but generation failed" (it is often a server-side problem; ask the user to tell the administrator). **Do not make test videos to look for the cause** (for example, creating many versions with fewer cuts — each one uses GPU and money, and takes tens of minutes).
   - If submit returns `503 DRAFT_WORKER_UNAVAILABLE`, that cut was not submitted. Just run `nolang submit <dir>` again. If the same happens twice in a row, generation has died on the server side (status stays `running`) — do not wait; delete `<dir>/stream.json` and start again with the same draft from `nolang start … --pin <that video_id>` (it carries over the pictures that run made and the voices it chose). The output's `fix` shows the same steps.

### Carry over assets from an earlier video (`nolang pull` and `--pin`)

- `nolang pull <dir> <video_id or URL>`: writes the saved draft of a template or of your own video to `<dir>/reference/` (`design.txt`, `timeline.txt`, and `brief.md` = a summary of its form).
- `--pin <video_id>` (`nolang check`, `nolang create`, `nolang start`): carries over that video's asset ledger. Assets in your draft whose **text is identical** to those in that video's draft resolve to the same assets — for your own video, the pictures, voices and text styles; for a template, the text styles, fonts and `id=` assets. Assets whose text you changed are chosen again or made again.
- **Fix your own video and render it again**: `pull` → copy `design.txt` and `timeline.txt` from `reference/` to directly under `<dir>` → rewrite only the parts to fix (do not change a single character in the lines for pictures and voices you want to keep; for pictures you want to change, rewrite the description) → `nolang check <dir> --language <language> --pin <video_id>` → `nolang create <dir> --title '<title>' --language <language> --pin <video_id>`. If you change the root's art-style line (`art` etc.), all pictures are made again.
- **Write something new in a template's form**: `pull` → read `brief.md` and the draft, write a new one, and add the same `--pin <template's video_id>` (the template's text styles and fonts are used as they are).
- Give `nolang check` the same `--language` and `--pin` values that you pass to `create` / `start` (so it gives the same answer as the check at submission). Do not add them in a dir where `start` has already run (it then checks with that video's settings — a check of a draft in progress; once you have written up to the last cut, add `--end`).

### Cut and use brought-in audio, or get only a transcript (`nolang transcribe` and `--speech`)

- `nolang transcribe <audio or video file or id>… [--speakers N] [--language <language>]`: transcribes audio (mp3, m4a, wav, etc.) or a video of someone speaking (mp4, webm, mov) (up to 4), and returns an utterance ledger (`brief` = for each utterance, its id, time and original text, and how to write `@clip`). **It consumes credit** (proportional to the audio length; about 3 per minute; the same audio is charged only once). A video also becomes a video asset with the same id, so in the draft you can place footage on the same clock as the voice (`content: @clip` in `brief`).
- To cut and use that audio in the draft (overlaying captions or diagrams on the speaker's own narration), write `@clip` as `brief` shows, and pass the returned ids to `nolang check`, `nolang create` and `nolang start` as `--speech <id>[,<id>]` (the same value for all three).
- If you only want to read the lines and times of a reference video, do not add `--speech` (NoLang synthesizes the voice).

### Add moving footage (AI clips, `--clip-seconds`)

- If you add `--clip-seconds <seconds>` to `nolang create` / `nolang start`, the `media: footage` pictures in the draft (`img#name(media: footage) description`) are made with video generation. For how to write them, read `ai_clips.md` in the `nolang reference` dir.
- The seconds are the upper limit for the total of newly made clips. That many seconds are charged up front (the credit per second is `ai_clip_credit_per_second` in `nolang account`), then settled to what was actually made. Anything over the limit becomes a generated image.
- **Standard plans and above only** (refused on the free plan — check the plan with `nolang account`). Without this flag, `media: footage` becomes a generated image.
- Use it only for videos built mainly on real footage (cooking, vlogs, etc.) or for scenes where the user asked for moving footage. Clips that have finished being made are billed even if you stop before rendering.

### Check the pictures before submitting (`nolang stills`)

- After `nolang start`, `nolang stills <dir> [cut]` renders a cut that has not been submitted yet (default = the next cut) as stills with the real pictures, and puts them in `<dir>/stills/<cut>/` (tens of seconds or more; up to 4 images). Look at the images; if they are fine, run `nolang submit`; to fix something, rewrite the cut, run `nolang check <dir>` → and then `nolang stills` again.
- The pictures and voices made here are used as they are if you submit a cut with the same text. **They are billable as soon as they are made** (they are included in the settlement even if you do not submit them), so do not keep making trial renders just to look.
- A picture whose name comes back in `unwarmed` was not ready in time and was drawn with a placeholder picture (do not judge it by its content).
- Stills and `nolang check` (in a dir where start has run) restart the 600-second count between submissions.

## B. Make it with MCP (when there is no shell)

Write the whole draft, then pass it in one go. The NoLang server checks and fixes it (you do not need to stream cuts in order or send signals).
It costs less credit than `nolang_create_video`, which has NoLang write the script (you do not pay for the LLM that writes the script and the screens).

### Check the connection

- If you can see `nolang_draft_submit`, you are ready (the actual name has a client-specific prefix).
- If you cannot see it: ask the user to add `https://api.no-lang.com/agent/mcp` to the client's connectors (MCP) and connect (they log in to NoLang and allow access when connecting).
- If it does not connect or the user cannot log in → tell the user. The endpoints are `https://api.no-lang.com` (API) and `https://no-lang.com` (login).

### Steps

Read the server's current docs with `nolang_draft_reference`, as in step 0 of §1.

1. **Write**: write the §1 draft up to the last cut (design = the root + the `section#name` blocks of all cuts; timeline = the root + the `*** name` blocks of all cuts).
2. **Check** (optional): `nolang_draft_check(design, timeline, language, aspect_ratio)` — if `defects` come back, fix them. If you leave them, the server's fixer fixes them, but getting them to 0 before you submit gives the result you intend. It consumes nothing.
3. **Submit**: `nolang_draft_submit(title, aspect_ratio, language, design, timeline)` → `stage: accepted` and `watch_url`. `language` is the language of the lines you wrote (required). `aspect_ratio` is the same ratio as the root's `canvas` (16:9 = `canvas 1920x1080`, 9:16 = `canvas 1080x1920`). For a video the user wants to adjust in the editor after generation, use `editable=true` (write within the grammar subset the editor can handle; for the check before submitting, use `nolang_draft_check(profile="editable")`).
4. **Notify** (always; before you call the next tool): write the guidance sentence and, on the next line, only the `watch_url`, and give it to the user (it is playable while it is still generating, and completes in a few minutes). If nothing else was asked, end the turn. Check for completion only when asked (`completed` from `nolang_video_status` — also pass on `download_url` and the credit notice `copyright`).

### Rules to follow

- `stage: in_progress` = the same draft is still being accepted — wait a little and call again with the same draft. Resubmitting the same draft returns the same video (so calling again after losing the response does not create duplicate videos).
- Shape errors (`design` has no cut, the cuts in design and timeline do not match, the root's `canvas` differs from `aspect_ratio`) are returned as an error. Fix them and submit again.
- `nolang_video_status` returning `failed` = there was a cut that could not be fully fixed (the credit is refunded). Fix the `defects` from `nolang_draft_check` and submit again.
- Brought-in audio, carrying over a reference video's assets, and AI clips cannot be used through this entry point (use §A in an environment with a shell). NoLang assets can be used by writing the `ref` from `nolang_assets_search` in the draft.
