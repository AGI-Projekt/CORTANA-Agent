"""Least-privilege tool registry with explicit allowlists and argument validation."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Callable
ToolHandler = Callable[[dict[str, Any]], Any]

@dataclass(frozen=True, slots=True)
class Tool:
    name: str
    handler: ToolHandler
    required_fields: frozenset[str] = frozenset()
    description: str = ""

class ToolRegistry:
    def __init__(self, allowed_tools: set[str] | frozenset[str] = frozenset()) -> None:
        self._allowed = frozenset(allowed_tools)
        self._tools: dict[str, Tool] = {}
    def register(self, tool: Tool) -> None:
        if not tool.name or not tool.name.replace("_", "").isalnum(): raise ValueError("tool name must be a non-empty identifier")
        if tool.name in self._tools: raise ValueError(f"tool already registered: {tool.name}")
        self._tools[tool.name] = tool
    def invoke(self, name: str, arguments: dict[str, Any]) -> Any:
        if name not in self._allowed: raise PermissionError(f"tool is not allowlisted: {name}")
        tool = self._tools.get(name)
        if tool is None: raise KeyError(f"tool is not registered: {name}")
        if not isinstance(arguments, dict): raise TypeError("tool arguments must be a dictionary")
        missing = tool.required_fields.difference(arguments)
        if missing: raise ValueError(f"missing required arguments: {', '.join(sorted(missing))}")
        return tool.handler(arguments)
    @property
    def registered_tools(self) -> tuple[str, ...]: return tuple(sorted(self._tools))
