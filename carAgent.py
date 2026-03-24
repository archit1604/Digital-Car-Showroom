import asyncio
import json
import os

from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import ConfigurableField                    
from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools import tool
from langchain_openai import AzureChatOpenAI
from pydantic import SecretStr
from dotenv import load_dotenv

load_dotenv()

# ─── Azure OpenAI LLM Setup ───────────────────────────────────────────────────

OPENAI_API_KEY = SecretStr(os.environ["OPENAI_API_KEY"])

llm = AzureChatOpenAI(
    azure_endpoint="https://aoai-farm.bosch-temp.com/api/",
    azure_deployment="askbosch-prod-farm-openai-gpt-4o-mini-2024-07-18",
    api_key=OPENAI_API_KEY,
    api_version="2025-04-01-preview",
    temperature=0.0,
    streaming=True,
    default_headers={
        "Authorization": f"Bearer {OPENAI_API_KEY.get_secret_value()}",
    },
# actually reach the LLM layer. Without this, callbacks are silently dropped.
).configurable_fields(
    callbacks=ConfigurableField(
        id="callbacks",
        name="callbacks",
        description="A list of callbacks to use for streaming",
    )
)

# ─── Agent Prompt ─────────────────────────────────────────────────────────────

prompt = ChatPromptTemplate.from_messages([
    ("system", (
        "You are an expert car salesperson working for a premium digital car showroom. "
        "Your job is to create engaging, persuasive sales descriptions for vehicles.\n\n"

        "When given vehicle specifications, you MUST first call the tool "
        "`generate_car_pitch` with those specifications.\n\n"

        "After receiving the tool output, write a compelling 2 to 3 paragraph "
        "sales pitch for a potential buyer. The tone should be friendly, "
        "enthusiastic, and professional. Highlight the strengths of vehicle "
        "and explain why it would be a great purchase.\n\n"

        "Do not use bullet points or headers. Write natural flowing paragraphs.\n\n"

        "Finally, call the tool `final_answer` with the generated pitch."
    )),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# ─── Tools ────────────────────────────────────────────────────────────────────

@tool
def generate_car_pitch(
    make: str,
    model: str,
    year: int,
    body_style: str,
    price: str,
    mileage: str,
    engine: str,
) -> str:
    """
    Accepts structured vehicle specifications and returns a context string
    that the agent should use to compose a compelling buyer-facing sales pitch.
    """
    return (
        f"Vehicle confirmed: {year} {make} {model} — {body_style}. "
        f"Price: {price}. Mileage: {mileage}. Engine: {engine}. "
        "Now write a warm, engaging 2-3 paragraph sales pitch for a potential buyer. "
        "Open with a compelling hook, weave in the key specs naturally, "
        "and close with an inviting call-to-action. No lists or headers."
    )


@tool
def final_answer(answer: str, tools_used: list[str]) -> dict:
    """Use this tool to deliver the final answer to the user."""
    return {"answer": answer, "tools_used": tools_used}


car_agent_tools = [generate_car_pitch, final_answer]
name2tool = {t.name: t.func for t in car_agent_tools}  

# ─── Streaming Callback Handler ───────────────────────────────────────────────

class QueueCallbackHandler(AsyncCallbackHandler):
    """
    Pushes LLM token chunks into an asyncio.Queue so the FastAPI endpoint
    can consume them as a stream.

    Sends "<<DONE>>" into the queue only when the final_answer tool is detected,
    and "<<STEP_END>>" after every other tool call so the agent loop can continue.

    NOTE: Because tool_choice="any" forces the LLM to always call a tool,
    all text arrives inside tool_call_chunks JSON arguments — content is always
    empty. We buffer the full argument string and decode it with json.loads on
    on_llm_end to avoid split-escape-sequence bugs (e.g. \n arriving as \ and
    n in separate chunks).
    """

    def __init__(self, queue: asyncio.Queue):
        self.queue = queue
        self.final_answer_seen = False
        self._current_tool_name = ""
        self._answer_buffer = ""   # accumulates raw JSON args for final_answer

    async def __aiter__(self):
        while True:
            if self.queue.empty():
                await asyncio.sleep(0.1)
                continue
            token_or_done = await self.queue.get()
            if token_or_done == "<<DONE>>":
                return
            if token_or_done == "<<STEP_END>>":
                continue
            if token_or_done:
                yield token_or_done

    async def on_llm_new_token(self, *args, **kwargs) -> None:
        chunk = kwargs.get("chunk")
        if not chunk:
            return

        try:
            tool_call_chunks = chunk.message.tool_call_chunks
        except Exception:
            tool_call_chunks = []

        for tc in tool_call_chunks:
            if tc.get("name"):
                self._current_tool_name = tc["name"]
                if self._current_tool_name == "final_answer":
                    self.final_answer_seen = True
                    self._answer_buffer = ""
                    self._inside_answer_value = False
                    self._yielded_chars = 0

            args_chunk = tc.get("args", "")
            if args_chunk and self._current_tool_name == "final_answer":
                self._answer_buffer += args_chunk
                extracted = self._safe_extract()
                if extracted:
                    await self.queue.put(extracted)

    def _safe_extract(self) -> str:
        buf = self._answer_buffer

        if not self._inside_answer_value:
            marker = '"answer"'
            idx = buf.find(marker)
            if idx == -1:
                return ""
            rest = buf[idx + len(marker):]
            rest = rest.lstrip()
            if not rest or rest[0] != ":":
                return ""
            rest = rest[1:].lstrip()
            if not rest or rest[0] != chr(34):
                return ""
            open_quote_pos = len(buf) - len(rest) + 1
            self._inside_answer_value = True
            self._yielded_chars = open_quote_pos

        result = []
        i = self._yielded_chars
        while i < len(buf):
            ch = buf[i]
            if ch == chr(92):
                if i + 1 >= len(buf):
                    break  # incomplete escape — wait for next chunk
                next_ch = buf[i + 1]
                escape_map = {
                    "n": chr(10),
                    "t": chr(9),
                    "r": chr(13),
                    chr(34): chr(34),
                    chr(92): chr(92),
                }
                result.append(escape_map.get(next_ch, next_ch))
                i += 2
            elif ch == chr(34):
                break  # closing quote
            else:
                result.append(ch)
                i += 1

        self._yielded_chars = i
        return "".join(result)

    async def on_llm_end(self, *args, **kwargs) -> None:
        if self.final_answer_seen:
            await self.queue.put("<<DONE>>")
        else:
            await self.queue.put("<<STEP_END>>")


# ─── Tool Executor ────────────────────────────────────────────────────────────

async def execute_tool(tool_call: AIMessage) -> ToolMessage:
    """Execute a single tool call and return its ToolMessage observation."""
    tc = tool_call.tool_calls[0]
    tool_name = tc["name"]
    tool_args = tc["args"]
    tool_out = name2tool[tool_name](**tool_args)
    return ToolMessage(
        content=f"{tool_out}",
        tool_call_id=tc["id"],
    )


# ─── Car Sales Agent Executor ─────────────────────────────────────────────────

class CarSalesAgentExecutor:
    """
    Custom agent executor for the car sales pitch use case.

    Each call to `invoke()` is fully stateless — no chat history is shared
    between requests, making it safe to use as a singleton in FastAPI.

    Flow per request:
      1. LLM is asked to write a sales pitch for a vehicle.
      2. LLM calls `generate_car_pitch` → receives enriched context.
      3. LLM composes the pitch and calls `final_answer`.
      4. Executor returns the `final_answer` tool_call dict.

    Args:
        max_iterations: Safety cap on agent loop iterations (default 3).
    """

    chat_history: list[BaseMessage]

    def __init__(self, max_iterations: int = 3):
        self.chat_history = []
        self.max_iterations = max_iterations
        self.agent: RunnableSerializable = (
            {
                "input": lambda x: x["input"],
                "chat_history": lambda x: x["chat_history"],
                "agent_scratchpad": lambda x: x.get("agent_scratchpad", [])
            }
            | prompt
            | llm.bind_tools(car_agent_tools, tool_choice="any")
        )

    async def invoke(self, input: str, streamer: QueueCallbackHandler, verbose: bool = False) -> dict:
        count = 0
        agent_scratchpad = []
        while count < self.max_iterations:

            async def stream(query: str):
                response = self.agent.with_config(callbacks=[streamer])
                output = None
                async for token in response.astream({
                    "input": query,
                    "chat_history": self.chat_history,
                    "agent_scratchpad": agent_scratchpad
                }):
                    if output is None:
                        output = token
                    else:
                        output += token
                    if token.content != "":
                        if verbose: print(f"content: {token.content}", flush=True)
                    tool_calls = token.additional_kwargs.get("tool_calls")
                    if tool_calls:
                        if verbose: print(f"tool_calls: {tool_calls}", flush=True)
                        tool_name = tool_calls[0]["function"]["name"]
                        if tool_name:
                            if verbose: print(f"tool_name: {tool_name}", flush=True)
                        arg = tool_calls[0]["function"]["arguments"]
                        if arg != "":
                            if verbose: print(f"arg: {arg}", flush=True)
                return AIMessage(
                    content=output.content,
                    tool_calls=output.tool_calls,
                    tool_call_id=output.tool_calls[0]["id"]
                )

            tool_call = await stream(query=input)
            agent_scratchpad.append(tool_call)
            tool_name = tool_call.tool_calls[0]["name"]
            tool_args = tool_call.tool_calls[0]["args"]
            tool_call_id = tool_call.tool_call_id
            tool_out = name2tool[tool_name](**tool_args)
            tool_exec = ToolMessage(
                content=str(tool_out),
                tool_call_id=tool_call_id
            )
            agent_scratchpad.append(tool_exec)
            count += 1
            if tool_name == "final_answer":
                break

        final_answer = tool_out["answer"]
        self.chat_history.extend([
            HumanMessage(content=input),
            AIMessage(content=final_answer)
        ])
        return tool_args


car_agent = CarSalesAgentExecutor()