"""
Gemini chat provider with tool/function calling support.
Accepts OpenAI-format tools and messages; returns OpenAI-format tool_calls and message
for compatibility with the agent workflow (system.workflow.agent).
"""
import json
import os
import uuid
import warnings

SUPPORTED_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp",
]

FEATURES = ["chat", "stream", "tools", "function_calling"]


def info(input, context):
    return {
        "name": "provider.llm.gemini",
        "models": SUPPORTED_MODELS,
        "features": FEATURES,
    }


def chat(input, context):
    warnings.filterwarnings("ignore", category=FutureWarning)
    import google.generativeai as genai

    api_key = _resolve_api_key(context)
    genai.configure(api_key=api_key)

    model_id = input.get("modelId") or input.get("llm") or "gemini-2.0-flash"
    messages = input.get("messages", [])
    parameters = input.get("parameters") or {}
    tools = input.get("tools")
    tool_choice = input.get("tool_choice")

    generation_config = {}
    if "temperature" in parameters:
        generation_config["temperature"] = parameters["temperature"]
    if "max_tokens" in parameters:
        generation_config["max_output_tokens"] = parameters["max_tokens"]
    if "maxOutputTokens" in parameters:
        generation_config["max_output_tokens"] = parameters["maxOutputTokens"]

    if "temperature" in input and input["temperature"] is not None:
        generation_config["temperature"] = input["temperature"]
    if "max_tokens" in input and input["max_tokens"] is not None:
        generation_config["max_output_tokens"] = input["max_tokens"]

    # Build Gemini tools from OpenAI-format tools
    gemini_tools = None
    if tools and len(tools) > 0:
        declarations = _openai_tools_to_declarations(tools)
        if declarations:
            # google-generativeai expects Tool with function_declarations
            gemini_tools = [{"function_declarations": declarations}]

    model_kw = {"model_name": model_id}
    if generation_config:
        model_kw["generation_config"] = generation_config
    if gemini_tools:
        model_kw["tools"] = gemini_tools

    model = genai.GenerativeModel(**model_kw)

    # Build prompt or contents. For first turn (no assistant/tool messages), use simple prompt with tools.
    contents = _messages_to_gemini_contents(messages)
    has_tool_history = any(
        (m.get("role") or "").lower() in ("assistant", "tool")
        for m in messages
    )

    if not contents:
        prompt = (messages[0].get("content") or "").strip() if messages else "Hello"
        response = model.generate_content(prompt)
    elif not has_tool_history and gemini_tools:
        # First turn with tools: single prompt so model can return function_call
        prompt = _first_turn_prompt(messages)
        response = model.generate_content(prompt)
    elif has_tool_history and contents:
        # Multi-turn with tool results: need full conversation
        try:
            api_contents = _contents_for_sdk(contents)
            response = model.generate_content(api_contents)
        except Exception:
            prompt = _messages_to_prompt_fallback(messages)
            response = model.generate_content(prompt)
    else:
        prompt = _messages_to_prompt_fallback(messages)
        response = model.generate_content(prompt)

    try:
        return _gemini_response_to_openai_format(response, model_id)
    except Exception as e:
        if "function_call" in str(e) or "text" in str(e).lower():
            return _gemini_response_from_candidates_only(response, model_id)
        raise


def _openai_tools_to_declarations(tools):
    """Convert OpenAI-format tools to Gemini function_declarations."""
    declarations = []
    for t in tools:
        if not isinstance(t, dict) or t.get("type") != "function":
            continue
        fn = t.get("function") or {}
        name = fn.get("name") or ""
        if not name:
            continue
        decl = {
            "name": name,
            "description": fn.get("description") or "",
            "parameters": fn.get("parameters") or {"type": "object", "properties": {}},
        }
        declarations.append(decl)
    return declarations


def _messages_to_gemini_contents(messages):
    """
    Convert OpenAI-format messages to Gemini contents (list of role/parts).
    Last content must be "user" so the model generates the next reply.
    """
    contents = []
    i = 0
    while i < len(messages):
        m = messages[i]
        if not isinstance(m, dict):
            i += 1
            continue
        role = (m.get("role") or "user").lower()

        if role == "system":
            text = (m.get("content") or "").strip()
            if text and contents and contents[-1].get("role") == "user":
                parts = contents[-1].get("parts", [])
                for p in parts:
                    if isinstance(p, dict) and "text" in p:
                        p["text"] = text + "\n\n" + (p["text"] or "")
                        break
            elif text:
                contents.append({"role": "user", "parts": [{"text": text}]})
            i += 1
            continue

        if role == "user":
            content = (m.get("content") or "").strip()
            contents.append({"role": "user", "parts": [{"text": content or " "}]})
            i += 1
            continue

        if role == "assistant":
            content = (m.get("content") or "").strip()
            tool_calls = m.get("tool_calls") or []
            parts = []
            if content:
                parts.append({"text": content})
            for tc in tool_calls:
                fn = tc.get("function") if isinstance(tc, dict) else {}
                if fn:
                    name = fn.get("name") or ""
                    args = fn.get("arguments")
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except (json.JSONDecodeError, TypeError):
                            args = {}
                    parts.append({
                        "function_call": {
                            "name": name,
                            "args": args or {},
                        }
                    })
            if parts:
                contents.append({"role": "model", "parts": parts})
            i += 1
            continue

        if role == "tool":
            tool_parts = []
            model_parts = contents[-1].get("parts", []) if contents and contents[-1].get("role") == "model" else []
            fc_names = [
                p.get("function_call", {}).get("name") or "tool"
                for p in model_parts
                if isinstance(p, dict) and "function_call" in p
            ]
            while i < len(messages) and (messages[i].get("role") or "").lower() == "tool":
                tm = messages[i]
                content = tm.get("content")
                if content is None:
                    content = ""
                if isinstance(content, dict):
                    content = json.dumps(content)
                try:
                    response_data = json.loads(content) if isinstance(content, str) else content
                except (json.JSONDecodeError, TypeError):
                    response_data = {"result": content}
                name = fc_names[len(tool_parts)] if len(tool_parts) < len(fc_names) else "tool"
                tool_parts.append({
                    "function_response": {
                        "name": name,
                        "response": response_data,
                    }
                })
                i += 1
            if tool_parts:
                contents.append({"role": "user", "parts": tool_parts})
            continue

        i += 1

    return contents


def _first_turn_prompt(messages):
    """Build single prompt from system + user for first turn (with tools)."""
    parts = []
    for m in messages:
        role = (m.get("role") or "user").lower()
        if role == "system":
            parts.append((m.get("content") or "").strip())
        elif role == "user":
            parts.append((m.get("content") or "").strip())
        if parts and role == "user":
            break
    return "\n\n".join(p for p in parts if p) or "Hello"


def _messages_to_prompt_fallback(messages):
    """Simple concatenation for fallback when contents format fails."""
    parts = []
    for m in messages:
        role = (m.get("role") or "user").lower()
        content = (m.get("content") or "").strip()
        if content:
            parts.append(f"{role}: {content}")
    return "\n\n".join(parts) if parts else "Hello"


def _contents_for_sdk(contents):
    """
    Return contents for generate_content. SDK may accept list of dicts (REST-style).
    If the SDK requires protos, the caller will catch and use prompt fallback.
    """
    return contents


def _gemini_response_to_openai_format(response, model_id):
    """Convert Gemini generate_content response to OpenAI-format (tool_calls, message, etc.)."""
    parts = []
    if response.candidates:
        content = response.candidates[0].content
        if hasattr(content, "parts") and content.parts:
            parts = list(content.parts)

    # Extract text from text parts only (accessing part.text can raise when part is function_call)
    text = ""
    for part in parts:
        try:
            ptext = getattr(part, "text", None)
            if ptext:
                text = (text + " " + (ptext or "")).strip()
        except Exception:
            pass
        if isinstance(part, dict) and part.get("text"):
            text = (text + " " + part["text"]).strip()

    finish_reason = "stop"
    if response.candidates:
        c0 = response.candidates[0]
        fr = getattr(c0, "finish_reason", None)
        if fr is not None:
            finish_reason = getattr(fr, "name", str(fr))

    usage = {}
    if getattr(response, "usage_metadata", None):
        um = response.usage_metadata
        usage["prompt_tokens"] = getattr(um, "prompt_token_count", None) or 0
        usage["completion_tokens"] = getattr(um, "candidates_token_count", None) or 0
        usage["total_tokens"] = usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)

    tool_calls = []
    openai_tool_calls = []

    for idx, part in enumerate(parts):
        fc = getattr(part, "function_call", None)
        if fc is None and isinstance(part, dict):
            fc = part.get("function_call")
        if not fc:
            continue
        name = getattr(fc, "name", None) or (fc.get("name") if isinstance(fc, dict) else None)
        args = getattr(fc, "args", None)
        if args is None and isinstance(fc, dict):
            args = fc.get("args", {})
        if args is None:
            args = {}
        # args might be a Struct (proto); convert to dict
        if hasattr(args, "items"):
            args = dict(args)
        elif not isinstance(args, dict):
            args = {}
        call_id = f"call_{uuid.uuid4().hex[:24]}"
        tool_calls.append({
            "id": call_id,
            "name": name or "unknown",
            "arguments": args,
        })
        openai_tool_calls.append({
            "id": call_id,
            "type": "function",
            "function": {
                "name": name or "unknown",
                "arguments": json.dumps(args),
            },
        })

    if tool_calls:
        finish_reason = "tool_calls"

    msg = {
        "role": "assistant",
        "content": text or None,
    }
    if openai_tool_calls:
        msg["tool_calls"] = openai_tool_calls

    return {
        "content": text,
        "finish_reason": finish_reason,
        "model": model_id,
        "usage": usage,
        "tool_calls": tool_calls,
        "message": msg,
    }


def _gemini_response_from_candidates_only(response, model_id):
    """Build OpenAI-format response from candidates/parts only (avoid response.text which fails for function_call)."""
    text = ""
    finish_reason = "stop"
    usage = {}
    tool_calls = []
    openai_tool_calls = []

    if getattr(response, "usage_metadata", None):
        um = response.usage_metadata
        usage["prompt_tokens"] = getattr(um, "prompt_token_count", None) or 0
        usage["completion_tokens"] = getattr(um, "candidates_token_count", None) or 0
        usage["total_tokens"] = usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)

    if not response.candidates:
        return {
            "content": "",
            "finish_reason": finish_reason,
            "model": model_id,
            "usage": usage,
            "tool_calls": [],
            "message": {"role": "assistant", "content": ""},
        }

    c0 = response.candidates[0]
    fr = getattr(c0, "finish_reason", None)
    if fr is not None:
        finish_reason = getattr(fr, "name", str(fr))

    content = getattr(c0, "content", None)
    parts = list(getattr(content, "parts", None) or [])

    for part in parts:
        if hasattr(part, "text") and part.text:
            text = (text + " " + (part.text or "")).strip()
        fc = getattr(part, "function_call", None)
        if fc is None:
            continue
        name = getattr(fc, "name", None) or ""
        args = getattr(fc, "args", None)
        if args is not None and hasattr(args, "items"):
            args = dict(args)
        else:
            args = {}
        call_id = f"call_{uuid.uuid4().hex[:24]}"
        tool_calls.append({"id": call_id, "name": name or "unknown", "arguments": args})
        openai_tool_calls.append({
            "id": call_id,
            "type": "function",
            "function": {"name": name or "unknown", "arguments": json.dumps(args)},
        })

    if tool_calls:
        finish_reason = "tool_calls"

    msg = {"role": "assistant", "content": text or None}
    if openai_tool_calls:
        msg["tool_calls"] = openai_tool_calls

    return {
        "content": text,
        "finish_reason": finish_reason,
        "model": model_id,
        "usage": usage,
        "tool_calls": tool_calls,
        "message": msg,
    }


def stream(input, context, emitter=None):
    """Streaming chat completion via Gemini API.

    When invoked with a StreamEmitter (3-arg), yields tokens incrementally.
    When invoked without (2-arg, inline-py sync mode), falls back to chat().
    """
    if emitter is None:
        return chat(input, context)

    warnings.filterwarnings("ignore", category=FutureWarning)
    import google.generativeai as genai

    api_key = _resolve_api_key(context)
    genai.configure(api_key=api_key)

    model_id = input.get("modelId") or input.get("llm") or "gemini-2.0-flash"
    messages = input.get("messages", [])
    parameters = input.get("parameters") or {}
    tools = input.get("tools")

    generation_config = {}
    if "temperature" in parameters:
        generation_config["temperature"] = parameters["temperature"]
    if "max_tokens" in parameters:
        generation_config["max_output_tokens"] = parameters["max_tokens"]
    if "maxOutputTokens" in parameters:
        generation_config["max_output_tokens"] = parameters["maxOutputTokens"]
    if "temperature" in input and input["temperature"] is not None:
        generation_config["temperature"] = input["temperature"]
    if "max_tokens" in input and input["max_tokens"] is not None:
        generation_config["max_output_tokens"] = input["max_tokens"]

    gemini_tools = None
    if tools and len(tools) > 0:
        declarations = _openai_tools_to_declarations(tools)
        if declarations:
            gemini_tools = [{"function_declarations": declarations}]

    model_kw = {"model_name": model_id}
    if generation_config:
        model_kw["generation_config"] = generation_config
    if gemini_tools:
        model_kw["tools"] = gemini_tools

    model = genai.GenerativeModel(**model_kw)

    contents = _messages_to_gemini_contents(messages)
    has_tool_history = any(
        (m.get("role") or "").lower() in ("assistant", "tool") for m in messages
    )

    if not contents:
        prompt = (messages[0].get("content") or "").strip() if messages else "Hello"
    elif not has_tool_history and gemini_tools:
        prompt = _first_turn_prompt(messages)
    elif has_tool_history and contents:
        prompt = None
    else:
        prompt = _messages_to_prompt_fallback(messages)

    if prompt is not None:
        response = model.generate_content(prompt, stream=True)
    else:
        try:
            api_contents = _contents_for_sdk(contents)
            response = model.generate_content(api_contents, stream=True)
        except Exception:
            prompt = _messages_to_prompt_fallback(messages)
            response = model.generate_content(prompt, stream=True)

    emitter.item_created("msg", "message", {"role": "assistant"})

    collected_text = []
    collected_tool_calls = []
    finish_reason = "stop"
    usage_data = {}

    for chunk in response:
        if not chunk.candidates:
            continue
        c0 = chunk.candidates[0]
        fr = getattr(c0, "finish_reason", None)
        if fr is not None:
            finish_reason = getattr(fr, "name", str(fr))

        content = getattr(c0, "content", None)
        parts = list(getattr(content, "parts", None) or [])

        for part in parts:
            try:
                ptext = getattr(part, "text", None)
                if ptext:
                    collected_text.append(ptext)
                    emitter.item_delta("msg", ptext)
            except Exception:
                pass

            fc = getattr(part, "function_call", None)
            if fc:
                name = getattr(fc, "name", None) or ""
                args = getattr(fc, "args", None)
                if args is not None and hasattr(args, "items"):
                    args = dict(args)
                else:
                    args = {}
                call_id = f"call_{uuid.uuid4().hex[:24]}"
                collected_tool_calls.append({
                    "id": call_id,
                    "name": name or "unknown",
                    "arguments": args,
                })

    if getattr(response, "usage_metadata", None):
        um = response.usage_metadata
        usage_data = {
            "prompt_tokens": getattr(um, "prompt_token_count", None) or 0,
            "completion_tokens": getattr(um, "candidates_token_count", None) or 0,
            "total_tokens": (getattr(um, "prompt_token_count", None) or 0) + (getattr(um, "candidates_token_count", None) or 0),
        }

    emitter.item_completed("msg")

    if usage_data:
        emitter.emit("usage.reported", "usage", usage_data)

    full_text = "".join(collected_text)

    if collected_tool_calls:
        finish_reason = "tool_calls"

    openai_tool_calls = []
    for tc in collected_tool_calls:
        openai_tool_calls.append({
            "id": tc["id"],
            "type": "function",
            "function": {"name": tc["name"], "arguments": json.dumps(tc["arguments"])},
        })

    msg = {"role": "assistant", "content": full_text or None}
    if openai_tool_calls:
        msg["tool_calls"] = openai_tool_calls

    result = {
        "content": full_text,
        "finish_reason": finish_reason,
        "model": model_id,
        "usage": usage_data,
        "tool_calls": collected_tool_calls,
        "message": msg,
    }

    return result


def _resolve_api_key(context):
    """Resolve API key from context secrets or environment."""
    secrets = context.get("secrets", {}) or {}
    key = (
        secrets.get("GOOGLE_API_KEY")
        or secrets.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
    )
    if not key:
        raise ValueError(
            "GOOGLE_API_KEY or GEMINI_API_KEY not found in context.secrets or environment"
        )
    return key
