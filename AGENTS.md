# Agents

This file documents the helper agents available to assist with repository tasks and how to invoke them.

Available agents

- **Explore** — Fast read-only codebase exploration and Q&A subagent.
  - Purpose: Quickly search the codebase, locate files, and answer questions about structure or symbols.
  - Invocation: call the `runSubagent` tool with `agentName: "Explore"` and include a prompt describing what to look for and desired thoroughness (quick/medium/thorough).
  - Example: ask the agent to "Find all usages of `createUser` across the repo (thorough)".

How to request an agent

- Tell me what you want the agent to do (e.g., "Run Explore to find TODOs in `service-assurance`"), and I will invoke it and return a concise summary of results.

Extending agents

- To add more agents, update this file with a short name, purpose, and example invocation, then register the agent in the orchestration layer that calls `runSubagent`.
