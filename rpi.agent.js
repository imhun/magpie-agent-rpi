// rpi (https://github.com/pi-rust/rpi) as a magpie agent.
//
// rpi keeps the providers it can reach in ~/.rpi/agent/models.json and the one
// a new session starts on in ~/.rpi/agent/settings.json, so the model lives in
// another file than the one connect() writes: that is what `startup` is for.
//
// rpi's models.json needs a provider's own model list — it does not ask the
// provider what it serves — so connect() writes magpie's models into it, one
// entry per model magpie offers, and keeps the ones that are already there.

const GATEWAY = "magpie"

// rpi's model entry, from what magpie knows of a model. Left out fields fall
// back to rpi's own defaults.
function entryOf(m) {
  const out = { id: m.id, name: m.name || m.id }
  if (m.context) out.contextWindow = m.context
  if (m.output) out.maxTokens = m.output
  out.input = m.images ? ["text", "image"] : ["text"]
  if (m.efforts && m.efforts.length) out.reasoning = true
  const c = m.pricing
  if (c) {
    out.cost = {
      input: Number(c.prompt || 0),
      output: Number(c.completion || 0),
      cacheRead: Number(c.input_cache_read || 0),
      cacheWrite: Number(c.input_cache_write || 0),
    }
  }
  return out
}

export const agent = {
  id: "rpi",
  name: "rpi",
  bin: "rpi",
  // the providers, and where connect() writes magpie's gateway
  config: "~/.rpi/agent/models.json",
  // the file a new session reads its model from
  startup: {
    config: "~/.rpi/agent/settings.json",
    model: "defaultModel",
    keys: { defaultProvider: GATEWAY },
  },
  // No prefix: rpi's defaultProvider already names the provider it reads the
  // model from, so defaultModel holds the bare model id. Adding "magpie/"
  // would leave rpi looking for a model whose id starts with one.
  ua: ["rpi"],
  // rpi reads these files on start: a running session keeps its model.
  notice: "rpi reads its settings when it starts: open a new session to use the new model.",
  library: {
    mcp: "~/.rpi/agent/mcp-adapter.json",
    mcpFormat: "claude",
    skills: "~/.rpi/agent/skills",
  },
}

// connect is given every model magpie offers the agent, and is called again
// when they change, so the list rpi reads stays current.
export function connect({ gateway, models }) {
  const list = (models || []).map(entryOf)
  return {
    [`providers.${GATEWAY}.name`]: GATEWAY,
    [`providers.${GATEWAY}.baseUrl`]: gateway.v1,
    [`providers.${GATEWAY}.apiKey`]: GATEWAY,
    [`providers.${GATEWAY}.api`]: "openai-completions",
    [`providers.${GATEWAY}.models`]: list,
  }
}
