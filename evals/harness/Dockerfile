# One image for every eval run: the agent's session and the hidden checks.
# Fixtures use only what is baked in here, so runs need no package registry.
FROM node:24-bookworm-slim

# One pinned version per agent CLI; the harness reads these lines for its cache keys.
ARG CLAUDE_CODE_VERSION=2.1.317
ARG CODEX_VERSION=0.166.0
ARG AGY_VERSION=1.4.12
# Antigravity CLI (agy), the successor to Gemini CLI; pinned from its release manifest (manifests/linux_amd64.json)
ARG AGY_URL=https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.12-4768735748292608/linux-x64/cli_linux_x64.tar.gz
ARG AGY_SHA512=ea01c73b772187bca928852cf96235f0d846d6da5ebdac188b9ae719597465737f325540d483ee5f3f62d151029001713344972a187ddfb98cc7b97f7204b7f4
ARG OPENCODE_VERSION=1.19.5
RUN apt-get update \
	&& apt-get install -y --no-install-recommends git ripgrep python3 python3-pytest jq ca-certificates procps curl \
	&& rm -rf /var/lib/apt/lists/* \
	&& npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" "@openai/codex@${CODEX_VERSION}" \
		"opencode-ai@${OPENCODE_VERSION}" \
	&& npm cache clean --force \
	&& curl -fsSL -o /tmp/agy.tar.gz "$AGY_URL" \
	&& echo "$AGY_SHA512  /tmp/agy.tar.gz" | sha512sum -c - \
	&& tar -xzf /tmp/agy.tar.gz -C /usr/local/bin antigravity && mv /usr/local/bin/antigravity /usr/local/bin/agy \
	&& chmod 755 /usr/local/bin/agy && rm /tmp/agy.tar.gz

# The node image's uid 1000 user; the host's workspace owner is uid 1000 too.
USER node
ENV HOME=/home/node
RUN git config --global user.name "eval agent" \
	&& git config --global user.email "agent@eval.invalid" \
	&& git config --global init.defaultBranch main \
	&& git config --global --add safe.directory '*'
WORKDIR /work
