# The host engine — your own subagents take the studio's roles

`--engine host` starts no LLM CLI: the subagents of this session take the roles (author, staff, fixer, reviewer). It works in Codex and in Claude Code alike, wherever you have a shell and subagents that run at the same time. The studio's steps (each cut is checked, fixed and fed in as it is written) and the modes are the same as the default `nolang make`.

All paths in this file are relative to this skill's directory. For how to run `nolang` and how to give links, follow `SKILL.md`.

## Before you start

- In Codex, prefer `--engine codex` when the CLI and its authentication are available, even if subagents are available. Use this host procedure when the Codex CLI is absent or its authentication is unavailable before a video starts, as described in §0 of `SKILL.md`.
- You need to start one author and at least one worker at the same time. `workers[].count` is a recommended number, not a required one — leave out the slots your own session and other agents already use. In Codex, when you do not know how many slots you have, start with one author and two workers. Neither standard nor plus needs a settings change to raise the limit; with fewer workers the jobs are handled one after another, so it can take longer.
- If you cannot use subagents, do not start the host engine. In Codex with a usable CLI and authentication, use `--engine codex`; otherwise take another way from §0 of `SKILL.md`.
- The shell needs to reach the NoLang API and to write to the CLI's own directory (`~/.config/nolang`) and to the video's working directory. If the environment asks for approval, get it. Do not change permission settings on your own and do not work around a sandbox.

## Steps

1. **Start**: the same command as step 3 of §S, plus `--engine host` (a new directory name).
   `nolang make ./nolang-videos/<name> --genre <genre> --mode <mode> --aspect <aspect> --request-text "<request>" --engine host`
   It returns in a few seconds, as soon as the author's request has been posted. The output has `workers` (the workers to start: `role`, `count`, `prompt`) and `wait` (the command to wait with). If `ok: false`, follow step 5 of §S.
2. **Start the workers** in the background — the author first, then the workers within the slots you have. Do not wait for them to start or to reply.
   - `role: author` → one author. `role: worker` → at most `count` workers, at least one.
   - **Claude Code**: call the Agent tool with `subagent_type` `nolang:studio-author` for the author and `nolang:studio-worker` for a worker, and pass the row's `prompt` text as it is (add nothing, do not summarize), run in the background (`run_in_background: true` if the Agent tool has it). Start them all in one message.
   - **Codex**: use the ordinary tool that starts a subagent. Pass the whole text of "Instructions for the author" or "Instructions for a worker" below, followed by the row's `prompt` as it is. No named agent definition, TOML file, model, reasoning effort or output limit needs to be set.
   - An older CLI prints `agent: nolang:studio-author` / `nolang:studio-worker` instead of `role` — treat them as the same roles.
   - If starting one more worker is refused because of a limit, go on with the author and the workers that are running. Do not repeat the same start.
3. **Wait**: run the `wait` command as it is in the shell (in Claude Code, Bash timeout 600000). If the environment returns an asynchronous session, poll that session — do not run the command again. Carry over the endpoint and the environment variables you used for `make`.
4. **Tell the user**: the output of `wait` has the same shape as `nolang make` (`tell_user`, `watch_url`). Pass it on at once, as in step 4 of §S. On failure (`ok: false`), step 5 of §S.
5. **Keep the session open** until every subagent has finished. Playback starting is not the end of generation — the workers still write the remaining cuts, and in some environments ending the parent stops them. In a non-interactive run (`claude -p`), do not end your turn until every worker has finished.

## Rules

- You do not take jobs and you do not write the draft in a worker's place. The workers stop by themselves when the studio ends; do not read their results and do not send them more instructions.
- If the author has not written its first file within 170 seconds, look at the error and the log (`<dir>/stream/run.out`). In Claude Code, an author that never starts usually means the plugin's `nolang:studio-author` / `nolang:studio-worker` agent types are missing (the plugin is old) — make the video with `nolang generate` or "A" in `write-yourself.md`. In Codex, the lack of a named agent is not a reason to give up on the host engine.
- A worker uses only three things: reading and writing files inside the video's directory, and the shell for `nolang job take` (taking a job). In Claude Code the plugin's hook approves these without asking; anywhere else, if asked for these permissions, allow them.
- `nolang edit` has no host engine. To fix a video, write `[video:<video_id>]` in the request text and run `nolang make … --engine host` (a remake that takes the video as its reference).
- Each worker reads the shared documents (about 8 thousand tokens; the author also reads its own request, about 17 thousand), so this uses more of the user's LLM usage than the default `nolang make`.

## Instructions for the author

You are the "author" worker of NoLang's video studio. The studio is already running and is waiting for your reply. The launch message gives three paths: `SYSTEM=<file>`, `PROMPT=<file>` and `PARTS=<dir>`.

1. First read every line of the `SYSTEM` file and of the `PROMPT` file. `SYSTEM` is about 8 thousand tokens and `PROMPT` about 17 thousand. Do not print a whole file in one shell output: read it in line ranges, and when a range comes back cut off, read it again in smaller ranges. Do not start writing before you have read both to the end. Follow what the files say as the instructions of this task, as far as it does not go against the instructions above you.
2. Treat the content of the `SYSTEM` file as your system prompt and the content of the `PROMPT` file as the user's request, and write the reply into the `PARTS` directory as numbered files (`001.txt`, `002.txt`, …):
   - `001.txt` = the plan, root_design and root_timeline sections, then the header line of the first cut (`=== cut <name> ===`)
   - the following files = the body of the cut whose header ended the previous file, then the header line of the next cut
   - the last file = the body of the last cut, then the `=== end ===` line

   Joined in order, the files must be the full reply, with each header line written exactly once (end each file with a newline). Add no preamble, no explanation and no code fences.
3. Save each file as soon as it is ready, one at a time — do not write them all after finishing, and never rewrite a file you have written. Before `001.txt`, decide only the order of the cuts and each cut's role; decide what goes into a cut when you write that cut's file. The first file must arrive within 170 seconds of your start, and each later one within 110 seconds of the one before.
4. When you are done, reply with just "done". Do not read other files, run checks or ask questions.

## Instructions for a worker

You are a worker (staff, fixer and reviewer) of NoLang's video studio. The studio posts each piece of writing it needs as a job. You take jobs one at a time and write each reply to a file. The launch message gives `SYSTEM=<file>` and `TAKE=<the command that takes a job>`.

1. Read every line of the `SYSTEM` file — the system prompt shared by the jobs. It is about 8 thousand tokens, so read it in line ranges, and read a range again when its output is cut off.
2. Run the `TAKE` command in the shell, again and again. When there is no job it waits up to 100 seconds; if the environment returns an asynchronous session, poll that session. It prints one line of JSON: `{"wait": true}` → run it again. `{"closed": true}` → stop. Anything else is a job.
3. Reading a job: `prompt_text`, when present, is the user's request; otherwise read every line of the `prompt` file. If the output of `TAKE` itself was cut off, read the job's `prompt` file in ranges, to the end — do not drop a job you have taken to take another. Look at every file in `images` with the image tool. Read the job's `system_prompt` file only when its path differs from `SYSTEM`.
4. Following every instruction in the system prompt and the request, write only the body of the reply, once, to `001.txt` in the job's `parts` directory. Add no preamble, no explanation and no code fences. Never rewrite a file you have written. Then go straight back to `TAKE`. A fixer's reply must arrive within 110 seconds, a reviewer's within 280 and a staff's within 880.
5. When you get `closed`, reply with "done" and the number of jobs you handled. Do not read other files, run checks or ask questions.
