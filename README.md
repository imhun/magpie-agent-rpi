# magpie-agent-rpi

[rpi](https://github.com/pi-rust/rpi) as a magpie agent. magpie has no setup of
its own for rpi; with this plugin rpi is on magpie's Agents page like the agents
magpie ships with.

```sh
magpie plugin add /path/to/magpie-agent-rpi
```

Then pick one of magpie's models in rpi's row:

```sh
magpie rpi deepseek/deepseek-v4-flash
```

## What magpie writes

`~/.rpi/agent/models.json` — magpie as a provider, with the models it offers
rpi:

```json
{
  "providers": {
    "magpie": {
      "name": "magpie",
      "baseUrl": "http://127.0.0.1:3425/v1",
      "apiKey": "magpie",
      "api": "openai-completions",
      "models": [
        { "id": "deepseek/deepseek-v4-flash", "name": "DeepSeek V4 Flash · DeepSeek",
          "contextWindow": 1048576, "maxTokens": 393216,
          "input": ["text", "image"], "reasoning": true,
          "cost": { "input": 1.5e-7, "output": 6e-7, "cacheRead": 3e-9, "cacheWrite": 0 } }
      ]
    }
  }
}
```

`~/.rpi/agent/settings.json` — the model a new session starts on:

```json
{ "defaultProvider": "magpie", "defaultModel": "opencode-go/deepseek-v4-flash" }
```

`defaultModel` holds the bare model id, not `magpie/<id>`: `defaultProvider`
already names the provider, so a prefix would leave rpi looking for a model
whose id starts with one.

Your other providers and settings stay. Picking rpi's own model again, or
switching it off, puts every key back as it was.

rpi reads these files when it starts, so open a new session to use the new
model.

## How it is put together

Three things about rpi shape this plugin:

**The model lives in a second file.** rpi keeps its providers in
`models.json` and the default model in `settings.json`. `config` is the file
`connect` writes; `startup` names the other, where magpie writes the model
beside `defaultProvider`.

**rpi needs each model spelled out.** It does not ask a provider what it
serves, so a provider with no `models` array resolves to nothing and the agent
reads as having no models at all. `connect` is handed every model magpie offers
the agent and writes them in, one entry per model, and is called again when
magpie's models change — so the list stays current instead of going stale.

**No `prefix`.** magpie adds the gateway's name itself when it offers a model,
and strips it again for the value it writes into the file — `settings.json`
ends up with the bare model id. Setting `prefix` puts a second one in the way
and rpi then finds no such model.

`connect` writes dotted key paths (`providers.magpie.models`), which magpie
sets in place, keeping whatever else the file holds. It runs when the model
actually changes: picking the model a row already shows reports `(unchanged)`
and calls nothing, so a provider removed by hand stays gone until the model
changes or the plugin is turned off and on again.

## Notes

- rpi's model id is `provider/model`, and magpie's provider is `magpie`. The
  `defaultProvider` key does the work, so no `prefix` is set.
- `library` gives rpi magpie's MCP servers (`~/.rpi/agent/mcp-adapter.json`,
  shape `claude`) and skills (`~/.rpi/agent/skills`). There is no rpi
  instructions file to target, so `library.instructions` is left out.
- If `~/.pi` is a symlink to `~/.rpi`, magpie's built-in **Pi** row writes the
  same files. Keep one or the other on, not both — and note that turning the
  Pi row off reverts the keys it wrote, `defaultProvider` and `defaultModel`
  among them, since they are the same file.

## Known limitation: Sessions and Usage call them `Pi`

magpie's session reader is hard-wired to agents it knows, and the agent plugin
protocol has no field for sessions — `id`, `name`, `config`, `format`, `model`,
`startup`, `prefix`, `bin`, `dir`, `ua`, `icon`, `notice` and `library` are all
it takes. So this plugin governs the model and nothing else.

rpi's sessions **are** read, because `internal/sessions/pi.go` looks in
`~/.pi` and `~/.pi` is `~/.rpi` on this setup — but they are filed under the
built-in `pi` agent, not `rpi`:

```
$ magpie sessions --json | jq -r '.[].agent' | sort | uniq -c
  15 pi
   3 codex
   2 opencode
```

What that costs, and what it doesn't:

- The sessions are listed, with titles, tokens and cost — just labelled `Pi`.
- The resume command magpie writes is `pi --session <id>`, which works when
  `pi` is rpi's shim (as it is here) and breaks if `pi` is ever the real
  TypeScript pi.
- If a real `pi` is installed beside rpi, both sets of sessions mix under one
  label, and neither can be filtered apart.

Tracked upstream as [`yetone/magpie#4043`](https://github.com/yetone/magpie/issues/4043),
which proposes `sessionDirs` in `settings.json`:
`[{"agent": "...", "format": "...", "dir": "..."}]` — reading an unknown
agent's folder in a format magpie already knows. It carries an `opencode`
format today; `pi` is the other reader a fork needs, since `piFilesIn(dir,
sessionDir)` and `piNamed(agent, paths)` are already parameterised and only
`PiDir()`/`"pi"` are hard-wired.
