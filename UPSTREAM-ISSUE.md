# Draft: upstream issue for yetone/magpie

Title: `sessions: a pi-format reader for settings.json sessionDirs, so a pi fork (rpi) is read under its own agent`

Status: not filed. #4043 proposes `sessionDirs` and carries an `opencode` format
only. This asks for `pi` as the second format there, and the reasoning below is
what makes the case. File it on #4043 as a comment, or as its own issue linking
to it — a comment keeps the mechanism in one place.

---

## Context

#4043 adds `settings.json` `sessionDirs`, handing a folder to a reader named by
`format`, and lists each entry's sessions under `agent` rather than the
reader's `opencode`:

```json
"sessionDirs": [{ "agent": "my-agent", "format": "opencode", "dir": "~/.local/share/my-agent" }]
```

That covers an OpenCode fork. The other case with the same shape is a **pi**
fork: `rpi` (github.com/pi-rust/rpi) is a Rust implementation that writes and
reads pi's own folder and pi's own session format — `<time>_<id>.jsonl`, the
same `sessions/<project>/` layout, the same line records.

It has none of the OpenCode problem: `rpi` keeps `~/.rpi/agent`, not
`~/.opencode`. So the folder is different (hence `sessionDirs`) and the format
is the one `piParse` already handles.

## What already works, without any change

`pi.go`'s `piFilesIn` and `piNamed` are parameterised already:

```go
func piFiles() []file { return piFilesIn(PiDir(), piSessionDir()) }

func piFilesIn(dir, sessionDir string) []file {
	if !Reads("pi") {
		return nil
	}
	paths, _ := filepath.Glob(filepath.Join(dir, "sessions", "*", "*.jsonl"))
	...
	return piNamed("pi", paths)
}

func piNamed(agent string, paths []string) []file { ... file{agent: agent, ...} }
```

So the reader takes both the folder and the agent name; only the call site
(`piFiles`) hard-wires `PiDir()` and `"pi"`. A `pi` format in #4043's dispatch
would be `piFilesIn(dir, sessionDirOf(dir))` and `piNamed(entry.agent, paths)`
— no new parsing, no new layout knowledge.

`piParse` is likewise already shared by four agents:

```go
case "pi", "raft", "cindy", "omp":
	return sessionParser{line: piParse}
```

which is the precedent that one reader serves several agents.

## Why it is worth it

A pi fork is not a niche shape: `rpi` exists, it is installed beside `pi` on
machines that have both, and the two are indistinguishable to magpie today
because both are found through `~/.pi` (`PiDir`, `PI_CODING_AGENT_DIR`). With
the folder named explicitly, the fork's sessions come out under its own agent
instead of being counted as `pi`.

## What happens without it

On a machine where `~/.pi` is a symlink to `~/.rpi` (a common way to run a pi
fork beside pi), the fork's sessions *are* read — but filed under `pi`:

```
$ magpie sessions --json | jq -r '.[].agent' | sort | uniq -c
  15 pi
   3 codex
   2 opencode
```

Two concrete costs:

1. **The resume command is wrong.** `resumeCommand`'s `case "pi":` writes
   `pi --session <id>`. That happens to work when `pi` is a shim for the fork,
   and silently runs the wrong binary when a real `pi` is installed beside it.
2. **Both sets mix under one label**, with no way to filter them apart, so the
   sessions and the spend of the two cannot be told apart.

## The same gap for the agent plugin protocol

Separately: `magpie-agent-*` plugins can declare `config`, `format`, `model`,
`startup`, `prefix`, `bin`, `dir`, `library` and the rest, but nothing about
sessions — so an agent added by a plugin is never read, even when its folder
and format are exactly what a built-in reader handles. `sessionDirs` with a
`pi` format closes that for the pi family without touching the plugin schema.
(That is why this is filed here rather than as an agent-plugin request.)

## Proposed shape

```json
"sessionDirs": [
  { "agent": "rpi", "format": "pi", "dir": "~/.rpi/agent" }
]
```

- `format: "pi"` dispatches to `piFilesIn` / `piNamed`, as `opencode` does to
  the OpenCode readers.
- `dir` is a pi agent folder: its `sessions/*/*.jsonl`, and its
  `settings.json` `sessionDir` read the way `piSessionDir()` reads pi's, so a
  fork that was told to keep sessions elsewhere is followed too.
- Sessions list, count and read under `agent` (`rpi`), not `pi`.
- `resume`: none guessed, as #4043 already does — an unknown agent's binary
  name is not magpie's to assume. (If wanted later, the plugin's `bin` could
  supply it, but that is a second change and out of scope here.)
- An agent magpie reads itself (`pi` in `ownSessionAgents`) is left out, so
  pi's own sessions keep their reader — the same rule #4043 applies for
  `opencode`.

Tests, following #4043's: one that a `pi`-format entry lists its sessions under
its own agent (fails without the change with `no <agent> session <id> in [...]`),
and one that an entry naming `pi` is left alone.
