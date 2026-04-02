import json
import os
import sys

SUPPORTED_MODELS = [
    "gpt-4o", "gpt-4o-mini", "gpt-4-turbo",
    "o1", "o1-mini", "o3-mini",
    "gpt-5.2",
]

# Reasoning models do not support temperature; they use max_completion_tokens instead of max_tokens.
REASONING_MODEL_PREFIXES = ("o1", "o3")

# Models that use max_completion_tokens instead of max_tokens (automatic mapping from max_tokens).
MODELS_USE_MAX_COMPLETION_TOKENS = ("gpt-5.2",)

FEATURES = ["chat", "stream", "tools", "function_calling"]


def _is_reasoning_model(model_id):
    return model_id and any(model_id.startswith(p) for p in REASONING_MODEL_PREFIXES)


def _use_max_completion_tokens(model_id):
    """True if this model expects max_completion_tokens instead of max_tokens."""
    if not model_id:
        return False
    if model_id in MODELS_USE_MAX_COMPLETION_TOKENS:
        return True
    return _is_reasoning_model(model_id)


def info(input, context):
    return {
        "name": "provider.llm.openai",
        "models": SUPPORTED_MODELS,
        "features": FEATURES,
    }


def chat(input, context, emitter=None):
    """Chat completion: sync when emitter is None; streaming when invoked with StreamEmitter (3-arg)."""
    if emitter is not None:
        return _chat_stream(input, context, emitter)

    from openai import OpenAI

    api_key = _resolve_api_key(context)
    client = OpenAI(api_key=api_key)

    model_id = input.get("modelId") or input.get("llm") or "gpt-4o-mini"
    messages = input.get("messages", [])
    # Single parameters envelope (temperature, max_tokens, timeout, etc.); contents vary by model.
    parameters = dict(input.get("parameters") or {})
    tools = input.get("tools")
    tool_choice = input.get("tool_choice")

    is_reasoning = _is_reasoning_model(model_id)
    use_max_completion = _use_max_completion_tokens(model_id)
    if is_reasoning:
        parameters.pop("temperature", None)
    if use_max_completion:
        max_tok = parameters.pop("max_tokens", None) or parameters.get("max_completion_tokens")
        if max_tok is not None:
            parameters["max_completion_tokens"] = max_tok
    else:
        max_tok = parameters.pop("max_completion_tokens", None)
        if max_tok is not None:
            parameters["max_tokens"] = max_tok

    parameters.pop("timeout", None)

    kwargs = {"model": model_id, "messages": messages, **parameters}

    if tools:
        kwargs["tools"] = tools
        if tool_choice:
            kwargs["tool_choice"] = tool_choice

    print(
        "openai_provider:chat - kwargs passed to LLM call:",
        json.dumps(kwargs, default=str, indent=2),
        flush=True,
        file=sys.stderr,
    )

    response = client.chat.completions.create(**kwargs)
    choice = response.choices[0]

    tool_calls = []
    openai_tool_calls = []
    if choice.message.tool_calls:
        for tc in choice.message.tool_calls:
            parsed_args = {}
            if tc.function.arguments:
                try:
                    parsed_args = json.loads(tc.function.arguments)
                except (json.JSONDecodeError, TypeError):
                    parsed_args = {}

            tool_calls.append({
                "id": tc.id,
                "name": tc.function.name,
                "arguments": parsed_args,
            })
            openai_tool_calls.append({
                "id": tc.id,
                "type": tc.type,
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                },
            })

    msg = {
        "role": choice.message.role,
        "content": choice.message.content,
    }
    if openai_tool_calls:
        msg["tool_calls"] = openai_tool_calls

    result = {
        "content": choice.message.content,
        "finish_reason": choice.finish_reason,
        "model": response.model,
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        },
        "tool_calls": tool_calls,
        "message": msg,
    }

    print(
        "openai_provider:chat - response from OpenAI LLM:",
        json.dumps(result, default=str, indent=2),
        flush=True,
        file=sys.stderr,
    )

    return result


def _chat_stream(input, context, emitter):
    """Streaming chat completion via OpenAI API (used when chat is invoked with StreamEmitter)."""
    from openai import OpenAI

    api_key = _resolve_api_key(context)
    client = OpenAI(api_key=api_key)

    model_id = input.get("modelId") or input.get("llm") or "gpt-4o-mini"
    messages = input.get("messages", [])
    parameters = dict(input.get("parameters") or {})
    tools = input.get("tools")
    tool_choice = input.get("tool_choice")

    is_reasoning = _is_reasoning_model(model_id)
    use_max_completion = _use_max_completion_tokens(model_id)
    if is_reasoning:
        parameters.pop("temperature", None)
    if use_max_completion:
        max_tok = parameters.pop("max_tokens", None) or parameters.get("max_completion_tokens")
        if max_tok is not None:
            parameters["max_completion_tokens"] = max_tok
    else:
        max_tok = parameters.pop("max_completion_tokens", None)
        if max_tok is not None:
            parameters["max_tokens"] = max_tok

    parameters.pop("timeout", None)

    kwargs = {"model": model_id, "messages": messages, "stream": True, **parameters}
    if "stream_options" not in kwargs:
        kwargs["stream_options"] = {"include_usage": True}

    if tools:
        kwargs["tools"] = tools
        if tool_choice:
            kwargs["tool_choice"] = tool_choice

    print(
        f"openai_provider:_chat_stream - invoking OpenAI model={model_id} msgCount={len(messages)} "
        f"tools={len(tools) if tools else 0} params={json.dumps({k: v for k, v in parameters.items()}, default=str)}",
        flush=True,
        file=sys.stderr,
    )

    emitter.item_created("msg", "message", {"role": "assistant"})

    collected_content = []
    collected_tool_calls = {}
    finish_reason = None
    usage_data = None
    chunk_count = 0

    response = client.chat.completions.create(**kwargs)

    for chunk in response:
        chunk_count += 1
        if chunk.usage:
            usage_data = {
                "prompt_tokens": chunk.usage.prompt_tokens,
                "completion_tokens": chunk.usage.completion_tokens,
                "total_tokens": chunk.usage.total_tokens,
            }

        if not chunk.choices:
            continue

        choice = chunk.choices[0]
        delta = choice.delta

        if delta and delta.content:
            token = delta.content
            collected_content.append(token)
            emitter.item_delta("msg", token)

        if delta and delta.tool_calls:
            for tc_delta in delta.tool_calls:
                idx = tc_delta.index
                if idx not in collected_tool_calls:
                    collected_tool_calls[idx] = {
                        "id": tc_delta.id or "",
                        "type": "function",
                        "function": {"name": "", "arguments": ""},
                    }
                entry = collected_tool_calls[idx]
                if tc_delta.id:
                    entry["id"] = tc_delta.id
                if tc_delta.function:
                    if tc_delta.function.name:
                        entry["function"]["name"] = tc_delta.function.name
                    if tc_delta.function.arguments:
                        entry["function"]["arguments"] += tc_delta.function.arguments

        if choice.finish_reason:
            finish_reason = choice.finish_reason

    emitter.item_completed("msg")

    print(
        f"openai_provider:_chat_stream - OpenAI stream done chunks={chunk_count} "
        f"contentLen={sum(len(c) for c in collected_content)} toolCalls={len(collected_tool_calls)} "
        f"finishReason={finish_reason} hasUsage={usage_data is not None}",
        flush=True,
        file=sys.stderr,
    )

    if usage_data:
        emitter.emit("usage.reported", "usage", usage_data)

    full_content = "".join(collected_content)
    tool_calls = []
    openai_tool_calls = []
    for idx in sorted(collected_tool_calls.keys()):
        tc = collected_tool_calls[idx]
        parsed_args = {}
        raw_args = tc["function"]["arguments"]
        if raw_args:
            try:
                parsed_args = json.loads(raw_args)
            except (json.JSONDecodeError, TypeError):
                parsed_args = {}
        tool_calls.append({
            "id": tc["id"],
            "name": tc["function"]["name"],
            "arguments": parsed_args,
        })
        openai_tool_calls.append(tc)

    msg = {"role": "assistant", "content": full_content}
    if openai_tool_calls:
        msg["tool_calls"] = openai_tool_calls

    result = {
        "content": full_content,
        "finish_reason": finish_reason or "stop",
        "model": model_id,
        "tool_calls": tool_calls,
        "message": msg,
    }
    if usage_data:
        result["usage"] = usage_data

    print(
        f"openai_provider:_chat_stream - returning result contentLen={len(full_content)} "
        f"finishReason={result['finish_reason']} toolCalls={len(tool_calls)} "
        f"content={full_content[:120]}{'...' if len(full_content) > 120 else ''}",
        flush=True,
        file=sys.stderr,
    )

    return result


def _resolve_api_key(context):
    """Resolve API key from context secrets or environment variable."""
    secrets = context.get("secrets", {})
    key = secrets.get("OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ValueError(
            "OPENAI_API_KEY not found in context.secrets or environment"
        )
    return key
